#!/usr/bin/env node
// Revisa el estado del stack simulado después de usarlo: invariantes de las
// bases de cada plataforma, pagos simulados de Mercado Pago contra lo que quedó
// en la base, mails enviados y errores del servidor.
//
//   tests/stack/check                  # todo desde que se sembró
//   tests/stack/check --since <ISO>    # sólo lo ocurrido desde esa hora
//   tests/stack/check --json
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const STACK = path.dirname(fileURLToPath(import.meta.url));
const RUN = path.join(STACK, '.run');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const seed = JSON.parse(readFileSync(path.join(RUN, 'seed.json'), 'utf8'));
const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : null;
const since = new Date(sinceArg ?? seed.createdAt);
if (Number.isNaN(since.getTime())) throw new Error(`--since inválido: ${sinceArg}`);

const findings = [];
const add = (severity, check, tenant, detail, rows = []) =>
  findings.push({ severity, check, tenant, detail, rows: rows.slice(0, 15), count: rows.length || undefined });

// Cada consulta devuelve las filas que violan la invariante.
const INVARIANTS = [
  {
    check: 'grupo-pago-sin-entradas',
    severity: 'alta',
    detail: 'Grupo PAID/FREE sin ninguna entrada emitida (alguien pagó o canjeó y no tiene entradas)',
    sql: `SELECT g.id, g.status, g."paymentMethod", g."amountTickets", g."createdAt", e.name AS evento
          FROM "ticketGroup" g JOIN event e ON e.id = g.event_id
          WHERE g.status IN ('PAID','FREE') AND NOT g."isOrganizerGroup"
            AND NOT EXISTS (SELECT 1 FROM "emittedTicket" t WHERE t."ticketGroupId" = g.id)
            -- El grupo FREE compartido donde viven los códigos sin canjear de cada
            -- organizador no tiene entradas por diseño.
            AND NOT EXISTS (SELECT 1 FROM "ticketXOrganizer" x WHERE x."ticketGroupId" = g.id)`,
  },
  {
    check: 'entradas-distintas-a-lo-reservado',
    severity: 'alta',
    detail: 'Cantidad de entradas emitidas distinta de la reservada en el grupo, por tipo',
    sql: `SELECT p."ticketGroupId", p."ticketTypeId", p.amount AS reservadas,
                 (SELECT count(*) FROM "emittedTicket" t WHERE t."ticketGroupId" = p."ticketGroupId" AND t."ticketTypeId" = p."ticketTypeId")::int AS emitidas,
                 g.status
          FROM "ticketTypePerGroup" p JOIN "ticketGroup" g ON g.id = p."ticketGroupId"
          WHERE g.status IN ('PAID','FREE')
            AND p.amount <> (SELECT count(*) FROM "emittedTicket" t WHERE t."ticketGroupId" = p."ticketGroupId" AND t."ticketTypeId" = p."ticketTypeId")`,
  },
  {
    check: 'sobreventa',
    severity: 'alta',
    detail: 'Tipo de entrada con más entradas emitidas que su cupo (maxAvailable)',
    sql: `SELECT tt.id, tt.name, e.name AS evento, tt."maxAvailable", count(t.id)::int AS emitidas
          FROM "ticketType" tt JOIN event e ON e.id = tt."eventId"
          JOIN "emittedTicket" t ON t."ticketTypeId" = tt.id
          JOIN "ticketGroup" g ON g.id = t."ticketGroupId" AND NOT g."isOrganizerGroup"
          GROUP BY tt.id, e.name HAVING count(t.id) > tt."maxAvailable"`,
  },
  {
    check: 'reservas-sobre-cupo',
    severity: 'media',
    detail: 'Emitidas + reservadas (BOOKED) superan el cupo del tipo de entrada',
    sql: `SELECT tt.id, tt.name, e.name AS evento, tt."maxAvailable",
                 (SELECT count(*) FROM "emittedTicket" t JOIN "ticketGroup" g ON g.id = t."ticketGroupId" WHERE t."ticketTypeId" = tt.id AND g.status <> 'BOOKED' AND NOT g."isOrganizerGroup")::int AS emitidas,
                 (SELECT coalesce(sum(p.amount),0) FROM "ticketTypePerGroup" p JOIN "ticketGroup" g ON g.id = p."ticketGroupId" WHERE p."ticketTypeId" = tt.id AND g.status = 'BOOKED')::int AS reservadas
          FROM "ticketType" tt JOIN event e ON e.id = tt."eventId"
          WHERE (SELECT count(*) FROM "emittedTicket" t JOIN "ticketGroup" g ON g.id = t."ticketGroupId" WHERE t."ticketTypeId" = tt.id AND g.status <> 'BOOKED' AND NOT g."isOrganizerGroup")
              + (SELECT coalesce(sum(p.amount),0) FROM "ticketTypePerGroup" p JOIN "ticketGroup" g ON g.id = p."ticketGroupId" WHERE p."ticketTypeId" = tt.id AND g.status = 'BOOKED')
              > tt."maxAvailable"`,
  },
  {
    check: 'compra-sobre-maximo-por-compra',
    severity: 'media',
    detail: 'Un grupo con más entradas de un tipo que maxPerPurchase',
    sql: `SELECT p."ticketGroupId", tt.name, p.amount, tt."maxPerPurchase", g.status
          FROM "ticketTypePerGroup" p JOIN "ticketType" tt ON tt.id = p."ticketTypeId"
          JOIN "ticketGroup" g ON g.id = p."ticketGroupId"
          WHERE NOT g."isOrganizerGroup" AND p.amount > tt."maxPerPurchase" AND g."invitedById" IS NULL`,
  },
  {
    check: 'escaneo-multiple',
    severity: 'alta',
    detail: 'Entrada que no admite reingreso con más de un escaneo registrado',
    sql: `SELECT t.id, t."fullName", tt.name, count(s.id)::int AS escaneos, min(s."scannedAt") AS primero, max(s."scannedAt") AS ultimo
          FROM "emittedTicket" t JOIN "ticketType" tt ON tt.id = t."ticketTypeId"
          JOIN "emittedTicketScan" s ON s."emittedTicketId" = t.id
          WHERE NOT tt."allowMultipleScans" GROUP BY t.id, tt.name HAVING count(s.id) > 1`,
  },
  {
    check: 'escaneada-sin-registro',
    severity: 'baja',
    detail: 'Entrada marcada como escaneada sin fila en emittedTicketScan (o al revés)',
    sql: `SELECT t.id, t."fullName", t.scanned, (SELECT count(*) FROM "emittedTicketScan" s WHERE s."emittedTicketId" = t.id)::int AS escaneos
          FROM "emittedTicket" t
          WHERE t.scanned <> EXISTS (SELECT 1 FROM "emittedTicketScan" s WHERE s."emittedTicketId" = t.id)`,
  },
  {
    check: 'entrada-en-otro-evento',
    severity: 'alta',
    detail: 'Entrada cuyo tipo, grupo o evento no coinciden',
    sql: `SELECT t.id, t."eventId", tt."eventId" AS evento_del_tipo, g.event_id AS evento_del_grupo
          FROM "emittedTicket" t JOIN "ticketType" tt ON tt.id = t."ticketTypeId" JOIN "ticketGroup" g ON g.id = t."ticketGroupId"
          WHERE t."eventId" <> tt."eventId" OR t."eventId" <> g.event_id`,
  },
  {
    check: 'codigo-de-invitacion-inconsistente',
    severity: 'alta',
    detail: 'Código de invitación asociado a una entrada de otro evento o canjeado dos veces',
    sql: `SELECT x.code, x."eventId", t."eventId" AS evento_entrada, x."ticketGroupId"
          FROM "ticketXOrganizer" x JOIN "emittedTicket" t ON t.id = x."ticketId"
          WHERE t."eventId" <> x."eventId"
          UNION ALL
          SELECT x.code, x."eventId", NULL, x."ticketGroupId" FROM "ticketXOrganizer" x
          WHERE x."ticketGroupId" IS NOT NULL
            -- Sólo grupos de canje (con reserva): el compartido del organizador
            -- agrupa todos sus códigos sin canjear.
            AND EXISTS (SELECT 1 FROM "ticketTypePerGroup" p WHERE p."ticketGroupId" = x."ticketGroupId")
            AND (SELECT count(*) FROM "ticketXOrganizer" y WHERE y."ticketGroupId" = x."ticketGroupId") > 1`,
  },
  {
    check: 'organizador-con-mas-codigos-que-cupo',
    severity: 'media',
    detail: 'Organizador con más códigos de invitación que su cupo asignado (eventXorganizer.ticketAmount)',
    sql: `SELECT e.name AS evento, u.name AS organizador, eo."ticketAmount", count(*)::int AS codigos
          FROM "eventXOrganizer" eo JOIN event e ON e.id = eo."eventId" JOIN "user" u ON u.id = eo."organizerId"
          JOIN "ticketXOrganizer" x ON x."eventId" = eo."eventId" AND x."organizerId" = eo."organizerId"
          WHERE e."inviteCondition" = 'INVITATION' AND eo."ticketAmount" IS NOT NULL
          GROUP BY e.name, u.name, eo."ticketAmount" HAVING count(*) > eo."ticketAmount"`,
  },
  {
    check: 'reparto-sobre-cupo-del-evento',
    severity: 'media',
    detail: 'La suma de invitaciones repartidas a organizadores supera el cupo del tipo de invitación',
    sql: `SELECT e.name AS evento, sum(eo."ticketAmount")::int AS repartidas,
                 (SELECT max(tt."maxAvailable") FROM "ticketType" tt WHERE tt."eventId" = e.id AND tt."visibleInWeb") AS cupo
          FROM "eventXOrganizer" eo JOIN event e ON e.id = eo."eventId"
          WHERE e."inviteCondition" = 'INVITATION'
          GROUP BY e.id, e.name
          HAVING sum(eo."ticketAmount") > (SELECT max(tt."maxAvailable") FROM "ticketType" tt WHERE tt."eventId" = e.id AND tt."visibleInWeb")`,
  },
  {
    check: 'reserva-vieja',
    severity: 'baja',
    detail:
      'Reservas sin pagar que siguen ocupando cupo después de su vencimiento (10 min sin medio de pago, 40 min en Mercado Pago; transferencia y cobro en el lugar no vencen)',
    sql: `SELECT g.id, g."createdAt", g."paymentMethod", e.name AS evento
          FROM "ticketGroup" g JOIN event e ON e.id = g.event_id
          WHERE g.status = 'BOOKED'
            AND EXISTS (SELECT 1 FROM "ticketTypePerGroup" p WHERE p."ticketGroupId" = g.id)
            AND ((g."paymentMethod" IS NULL AND g."createdAt" < now() - interval '15 minutes')
              OR (g."paymentMethod" = 'MERCADO_PAGO' AND g."createdAt" < now() - interval '45 minutes'))`,
  },
  {
    check: 'monto-inconsistente',
    severity: 'media',
    detail: 'Grupo pagado con total 0 o negativo teniendo entradas pagas',
    sql: `SELECT g.id, g."totalAmount", g."paymentMethod", e.name AS evento
          FROM "ticketGroup" g JOIN event e ON e.id = g.event_id
          WHERE g.status = 'PAID' AND g."totalAmount" <= 0
            AND EXISTS (SELECT 1 FROM "ticketTypePerGroup" p JOIN "ticketType" tt ON tt.id = p."ticketTypeId" WHERE p."ticketGroupId" = g.id AND tt.price > 0)
            AND g."createdAt" >= $1`,
    params: [since.toISOString()],
  },
];

function loadMails() {
  const dir = path.join(RUN, 'mails');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
}

function loadPreferences() {
  const dir = path.join(RUN, 'mp');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
}

async function checkTenant(slug, databaseName, mails, preferences) {
  const pool = new pg.Pool({ connectionString: `${process.env.PG_BASE}/${databaseName}`, max: 2 });
  try {
    for (const invariant of INVARIANTS) {
      try {
        const { rows } = await pool.query(invariant.sql, invariant.params ?? []);
        if (rows.length) add(invariant.severity, invariant.check, slug, invariant.detail, rows);
      } catch (error) {
        add('baja', `consulta-fallida:${invariant.check}`, slug, error.message);
      }
    }

    // Pagos aprobados en el Mercado Pago simulado contra la base.
    for (const pref of preferences.filter((p) => p.metadata?.instance_url?.includes(`//${slug}.`))) {
      const approved = pref.payments.filter((p) => p.action.startsWith('approve'));
      if (!approved.length) continue;
      const { rows } = await pool.query(
        `SELECT g.status, g."totalAmount", (SELECT count(*) FROM "emittedTicket" t WHERE t."ticketGroupId" = g.id)::int AS entradas
         FROM "ticketGroup" g WHERE g.id = $1`,
        [pref.external_reference],
      );
      const group = rows[0];
      const lost = approved.every((p) => p.action === 'approve-lost');
      const total = (pref.items ?? []).reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const ageMs = Date.now() - new Date(approved[0].at).getTime();
      if (!group) {
        add(lost ? 'media' : 'alta', 'pago-aprobado-grupo-borrado', slug,
          lost ? 'Pago aprobado cuyo aviso nunca llegó: el grupo se borró y el comprador pagó sin entradas (no hay conciliación)' : 'Pago aprobado en Mercado Pago cuyo grupo ya no existe en la base',
          [{ preferencia: pref.id, ticketGroupId: pref.external_reference, pagos: pref.payments.map((p) => p.action).join(','), total }]);
      } else if (!lost && ageMs > 40_000 && (group.status !== 'PAID' || group.entradas === 0)) {
        add('alta', 'pago-aprobado-sin-entradas', slug, 'Pago aprobado (con aviso enviado) pero el grupo no quedó PAID con entradas',
          [{ preferencia: pref.id, ticketGroupId: pref.external_reference, ...group, pagos: pref.payments.map((p) => p.action).join(',') }]);
      } else if (Number(group.totalAmount) !== total) {
        add('media', 'monto-cobrado-distinto', slug, 'El total cobrado en Mercado Pago no coincide con totalAmount del grupo',
          [{ preferencia: pref.id, ticketGroupId: pref.external_reference, cobrado: total, totalAmount: group.totalAmount }]);
      }
    }

    // Toda compra o canje desde la web (posterior a --since) tiene que mandar mail.
    const { rows: delivered } = await pool.query(
      `SELECT g.id, g.status, g."createdAt", e.name AS evento,
              (SELECT t.mail FROM "emittedTicket" t WHERE t."ticketGroupId" = g.id ORDER BY t."createdAt" LIMIT 1) AS mail,
              (SELECT count(*) FROM "emittedTicket" t WHERE t."ticketGroupId" = g.id)::int AS entradas
       FROM "ticketGroup" g JOIN event e ON e.id = g.event_id
       WHERE g.status IN ('PAID','FREE') AND NOT g."isOrganizerGroup" AND g."createdAt" >= $1`,
      [since.toISOString()],
    );
    const missing = delivered.filter(
      (group) => group.mail && !mails.some((mail) => JSON.stringify(mail.to ?? '').toLowerCase().includes(group.mail.toLowerCase())),
    );
    if (missing.length) {
      add('media', 'entradas-sin-mail', slug, 'Grupo con entradas emitidas cuyo comprador no recibió ningún mail', missing);
    }
  } finally {
    await pool.end();
  }
}

function serverErrors() {
  const file = path.join(RUN, 'logs', 'next.log');
  if (!existsSync(file)) return;
  const entries = [];
  let current = null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    // Avisos de Node (deprecaciones, features experimentales): no son de la app.
    if (/\(node:\d+\) (\[\w+\] )?\w*Warning/.test(line) || line.startsWith('(Use `node --trace')) continue;
    const match = line.match(/^\[(ERROR|WARN) (\d{4}-\d\d-\d\dT[^\]]+)\] ?(.*)$/);
    if (match) {
      if (current) entries.push(current);
      current = new Date(match[2]) >= since ? { level: match[1], time: match[2], text: match[3] } : null;
    } else if (current && /^[A-Za-z]/.test(line)) {
      // Un console.log sin nivel (los logs info del servidor) corta el error anterior.
      entries.push(current);
      current = null;
    } else if (current && line.trim() && current.text.length < 1500) {
      current.text += `\n${line}`;
    }
  }
  if (current) entries.push(current);
  const byMessage = new Map();
  for (const entry of entries) {
    const key = `${entry.level} ${entry.text.split('\n')[0].slice(0, 160)}`;
    const group = byMessage.get(key) ?? { level: entry.level, mensaje: entry.text.split('\n')[0].slice(0, 300), veces: 0, primera: entry.time, ultima: entry.time, ejemplo: entry.text.slice(0, 1200) };
    group.veces += 1;
    group.ultima = entry.time;
    byMessage.set(key, group);
  }
  const errors = [...byMessage.values()].filter((g) => g.level === 'ERROR');
  const warns = [...byMessage.values()].filter((g) => g.level === 'WARN');
  if (errors.length) add('alta', 'errores-del-servidor', 'servidor', 'Errores registrados por el servidor (agrupados por mensaje)', errors);
  if (warns.length) add('baja', 'avisos-del-servidor', 'servidor', 'Avisos del servidor (agrupados por mensaje)', warns);
}

async function main() {
  const control = new pg.Client({ connectionString: process.env.CONTROL_DATABASE_URL });
  await control.connect();
  const { rows: tenants } = await control.query(
    `SELECT slug, database_name FROM tenants WHERE status = 'active' AND database_name IS NOT NULL ORDER BY id`,
  );
  await control.end();
  const mails = loadMails();
  const preferences = loadPreferences();
  for (const tenant of tenants) await checkTenant(tenant.slug, tenant.database_name, mails, preferences);
  serverErrors();

  const order = { alta: 0, media: 1, baja: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  if (asJson) {
    console.log(JSON.stringify({ since: since.toISOString(), findings }, null, 2));
    return;
  }
  console.log(`Chequeo del stack desde ${since.toISOString()} — ${tenants.length} plataformas, ${mails.length} mails, ${preferences.length} preferencias de MP`);
  if (!findings.length) console.log('Sin problemas detectados.');
  for (const finding of findings) {
    console.log(`\n[${finding.severity}] ${finding.check} (${finding.tenant}) — ${finding.detail}${finding.count ? ` · ${finding.count} casos` : ''}`);
    for (const row of finding.rows) console.log(`  ${JSON.stringify(row).slice(0, 1500)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
