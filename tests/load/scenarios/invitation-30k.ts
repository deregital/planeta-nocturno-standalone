/**
 * Evento INVITATION de 30.000 cupos, un solo tenant, Postgres local (RTT 0).
 *
 * 1. events.create real (códigos md5 de 6 hex, sin mails ni PDFs).
 * 2. Redistribución del jefe sobre 30.000 códigos ya creados con códigos únicos.
 * 3. Canje de un lote chico contra ese pool.
 * 4. Escaneo de 30.000 entradas canjeadas, con QRs repetidos, inválidos y
 *    dos lectores sobre el mismo QR a la vez.
 *
 * El seed de los puntos 2 y 4 no usa el default md5: si la creación real falla
 * por colisión, igual se mide el resto del sistema con un evento válido.
 */
import type { Pool } from 'pg';
import type { OrganizerInvitationSchema } from '@/server/schemas/organizer';

import type { Db } from '@/drizzle';

import { applyChiefOrganizerInvitationDistribution } from '@/server/utils/chief-organizer-invitation-distribution';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { encryptString } from '@/server/utils/utils';
import { callerFor } from '@tests/load/lib/caller';
import {
  createScenarioDatabase,
  getQueryCount,
  openLoadDb,
  resetQueryCount,
} from '@tests/load/lib/db';
import {
  invitationInvariants,
  redeemInvitation,
} from '@tests/load/lib/invitation';
import { insertInvitationEvent, insertUser } from '@tests/load/lib/seed';
import {
  countBy,
  errorMessage,
  payloadBytes,
  runPool,
  summarize,
  timed,
} from '@tests/load/lib/stats';

const TOTAL = 30_000;
const ORGANIZERS = 20;
const PER_ORGANIZER = TOTAL / ORGANIZERS;
const CODE_SPACE = 16 ** 6;

type OrganizerRow = {
  id: string;
  dni: string;
  fullName: string;
  phoneNumber: string;
  role:
    | 'ADMIN'
    | 'CHIEF_ORGANIZER'
    | 'ORGANIZER'
    | 'TICKETING'
    | 'CONTROL_TICKETING';
};

function brief(error: unknown) {
  const message = errorMessage(error).replace(/\s+/g, ' ').trim();
  return message.length > 400 ? `${message.slice(0, 400)}…` : message;
}

function collisionProbability(existing: number, inserted: number) {
  const pairs = inserted * existing + (inserted * (inserted - 1)) / 2;
  return Math.round((1 - Math.exp(-pairs / CODE_SPACE)) * 1000) / 10;
}

function invitationEventInput(
  name: string,
  organizers: OrganizerRow[],
  amounts: Map<string, number>,
) {
  const total = organizers.reduce(
    (sum, organizer) => sum + (amounts.get(organizer.id) ?? 0),
    0,
  );
  return {
    event: {
      name,
      description: 'Evento por invitación de 30000',
      coverImageUrl: 'https://example.com/cover.jpg',
      videoUrl: null,
      startingDate: new Date(Date.now() + 7 * 86_400_000),
      endingDate: new Date(Date.now() + 7 * 86_400_000 + 8 * 3_600_000),
      minAge: null,
      isActive: true,
      locationId: null,
      categoryId: null,
      authorizedUsers: [],
      inviteCondition: 'INVITATION' as const,
      extraTicketData: false,
      serviceFee: null,
      emailNotification: null,
      ticketSlugVisibleInPdf: false,
      hasSimpleInvitation: false,
      descriptionTitleVisible: true,
    },
    ticketTypes: [
      {
        id: crypto.randomUUID(),
        name: 'Invitación',
        description: 'Entrada por invitación',
        price: 0,
        maxPerPurchase: 1,
        maxAvailable: total,
        maxSellDate: null,
        category: 'FREE' as const,
        startingDate: null,
        scanLimit: null,
        allowMultipleScans: false,
        visibleInWeb: true,
        lowStockThreshold: null,
      },
      {
        id: crypto.randomUUID(),
        name: 'Organizador',
        description: 'Tickets para los organizadores',
        price: 0,
        maxPerPurchase: 1,
        maxAvailable: organizers.length,
        maxSellDate: null,
        category: 'FREE' as const,
        startingDate: null,
        scanLimit: null,
        allowMultipleScans: false,
        visibleInWeb: false,
        lowStockThreshold: null,
      },
    ],
    organizersInput: organizers.map((organizer) => ({
      id: organizer.id,
      dni: organizer.dni,
      fullName: organizer.fullName,
      phoneNumber: organizer.phoneNumber,
      role: organizer.role,
      type: 'INVITATION' as const,
      ticketAmount: amounts.get(organizer.id) ?? 0,
    })),
    sendOrganizerTicketEmail: false,
    questions: [],
  };
}

async function loadOrganizers(raw: Pool, ids: string[]) {
  const { rows } = await raw.query(
    `SELECT id, dni, "fullName", "phoneNumber", role FROM "user" WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id as string, row]));
  return ids.map((id) => byId.get(id) as OrganizerRow);
}

async function tryCreate(
  db: Db,
  raw: Pool,
  adminId: string,
  label: string,
  organizers: OrganizerRow[],
  amounts: Map<string, number>,
  existingCodes: number,
) {
  const admin = callerFor(db, { id: adminId, role: 'ADMIN' });
  const inserted = [...amounts.values()].reduce((sum, n) => sum + n, 0);
  const started = Date.now();
  try {
    const { eventCreated } = await admin.events.create(
      invitationEventInput(label, organizers, amounts),
    );
    const { rows } = await raw.query(
      `SELECT count(*)::int AS codes FROM "ticketXOrganizer" WHERE "eventId" = $1`,
      [eventCreated.id],
    );
    await raw.query(`DELETE FROM "ticketXOrganizer" WHERE "eventId" = $1`, [
      eventCreated.id,
    ]);
    return {
      label,
      ok: true,
      ms: Date.now() - started,
      codes: rows[0].codes as number,
      expectedFailurePercent: collisionProbability(existingCodes, inserted),
    };
  } catch (error) {
    return {
      label,
      ok: false,
      ms: Date.now() - started,
      inserted,
      existingCodes,
      expectedFailurePercent: collisionProbability(existingCodes, inserted),
      error: brief(error),
    };
  }
}

type Team = { chiefId: string; subordinateIds: string[] };

async function teamInput(
  raw: Pool,
  team: Team,
  amounts: Map<string, number>,
): Promise<OrganizerInvitationSchema[]> {
  const ids = [team.chiefId, ...team.subordinateIds];
  const organizers = await loadOrganizers(raw, ids);
  return organizers.map((organizer) => ({
    id: organizer.id,
    dni: organizer.dni,
    fullName: organizer.fullName,
    phoneNumber: organizer.phoneNumber,
    role: organizer.role,
    type: 'INVITATION' as const,
    ticketAmount: amounts.get(organizer.id) ?? PER_ORGANIZER,
  }));
}

function amountsFor(team: Team, perSubordinate: number, chief: number) {
  const amounts = new Map<string, number>();
  for (const id of team.subordinateIds) amounts.set(id, perSubordinate);
  amounts.set(team.chiefId, chief);
  return amounts;
}

async function measureMove(
  db: Db,
  raw: Pool,
  eventId: string,
  team: Team,
  amounts: Map<string, number>,
) {
  const input = await teamInput(raw, team, amounts);
  resetQueryCount();
  const result = await timed(() =>
    applyChiefOrganizerInvitationDistribution(db, {
      chiefOrganizerId: team.chiefId,
      eventId,
      organizersInput: input,
    }),
  );
  return {
    ms: Math.round(result.ms),
    queries: getQueryCount(),
    invariants: await invitationInvariants(raw, eventId),
  };
}

async function scanGuests(
  db: Db,
  raw: Pool,
  eventId: string,
  log: (...args: unknown[]) => void,
) {
  const devices = 12;
  const scannerIds: string[] = [];
  for (let i = 0; i < devices; i++) {
    scannerIds.push(await insertUser(raw, 'CONTROL_TICKETING'));
  }
  const callers = scannerIds.map((id) =>
    callerFor(db, { id, role: 'CONTROL_TICKETING' }),
  );
  const { rows } = await raw.query(
    `SELECT e.id
     FROM "emittedTicket" e
     JOIN "ticketType" tt ON tt.id = e."ticketTypeId"
     WHERE e."eventId" = $1 AND tt.name <> $2
     ORDER BY e."shortId"`,
    [eventId, ORGANIZER_TICKET_TYPE_NAME],
  );
  const ticketIds = rows.map((row) => row.id as string);
  const raceCount = 48;
  const raceIds = ticketIds.slice(0, raceCount);
  const rest = ticketIds.slice(raceCount);

  const raceStatuses: string[] = [];
  const raceWall = await timed(() =>
    Promise.all(
      raceIds.map(async (id, index) => {
        const barcode = encryptString(id);
        const pair = await Promise.all(
          [0, 1].map((device) =>
            callers[device % devices].emittedTickets.scan({
              barcode,
              eventIds: [eventId],
            }),
          ),
        );
        raceStatuses.push(...pair.map((result) => result.status));
        if ((index + 1) % 16 === 0) {
          log(`carrera de doble escaneo ${index + 1}/${raceCount}`);
        }
      }),
    ),
  );

  const attempts = rest.map((id, index) =>
    index % 100 === 0
      ? 'qr-invalido'
      : index % 33 === 0 && index >= 500
        ? encryptString(rest[index - 500]!)
        : encryptString(id),
  );

  resetQueryCount();
  const statuses: string[] = [];
  const latencies: number[] = [];
  let next = 0;
  let done = 0;
  const wall = await timed(() =>
    Promise.all(
      callers.map(async (caller) => {
        while (next < attempts.length) {
          const barcode = attempts[next++]!;
          try {
            const result = await timed(() =>
              caller.emittedTickets.scan({ barcode, eventIds: [eventId] }),
            );
            latencies.push(result.ms);
            statuses.push(result.value.status);
          } catch (error) {
            statuses.push(`error: ${brief(error)}`);
          }
          done += 1;
          if (done % 5000 === 0) {
            log(`escaneos ${done}/${attempts.length}`);
          }
        }
      }),
    ),
  );

  const integrity = await raw.query(
    `SELECT count(*)::int AS guests,
            count(*) FILTER (WHERE e.scanned)::int AS scanned_flag,
            count(*) FILTER (WHERE coalesce(s.cnt, 0) = 1)::int AS exactly_one,
            count(*) FILTER (WHERE coalesce(s.cnt, 0) > 1)::int AS double_entry,
            count(*) FILTER (WHERE coalesce(s.cnt, 0) = 0)::int AS never_scanned,
            coalesce(sum(s.cnt), 0)::int AS scan_rows
     FROM "emittedTicket" e
     JOIN "ticketType" tt ON tt.id = e."ticketTypeId"
     LEFT JOIN (
       SELECT "emittedTicketId", count(*)::int AS cnt
       FROM "emittedTicketScan"
       GROUP BY 1
     ) s ON s."emittedTicketId" = e.id
     WHERE e."eventId" = $1 AND tt.name <> $2`,
    [eventId, ORGANIZER_TICKET_TYPE_NAME],
  );

  return {
    devices,
    guestTickets: ticketIds.length,
    simultaneousDoubleScan: {
      tickets: raceCount,
      wallMs: Math.round(raceWall.ms),
      statuses: countBy(raceStatuses, (status) => status),
    },
    door: {
      attempts: attempts.length,
      wallSeconds: Math.round(wall.ms / 100) / 10,
      scansPerSecond: Math.round((attempts.length / wall.ms) * 1000 * 10) / 10,
      latency: summarize(latencies),
      statuses: countBy(statuses, (status) => status),
      queriesPerScan: Math.round((getQueryCount() / attempts.length) * 10) / 10,
    },
    integrity: integrity.rows[0],
  };
}

export default async function run(log: (...args: unknown[]) => void) {
  const dbName = await createScenarioDatabase('invitation_30k');
  const { db, raw, close } = await openLoadDb(dbName, { poolMax: 20 });
  try {
    const settings = await raw.query(
      `SELECT current_setting('server_version') AS version,
              current_setting('max_locks_per_transaction') AS max_locks,
              current_setting('max_connections') AS max_connections`,
    );
    log('postgres', settings.rows[0], 'base', dbName);

    const adminId = await insertUser(raw, 'ADMIN');
    const singleId = await insertUser(raw, 'ORGANIZER');
    const single = await loadOrganizers(raw, [singleId]);
    log('creación real: 1 organizador con 30000 códigos');
    const createOne = await tryCreate(
      db,
      raw,
      adminId,
      'Invitation 30000 un organizador',
      single,
      new Map([[singleId, TOTAL]]),
      0,
    );
    log(createOne);

    const teamIds: string[] = [];
    for (let i = 0; i < 30; i++)
      teamIds.push(await insertUser(raw, 'ORGANIZER'));
    const teamUsers = await loadOrganizers(raw, teamIds);
    const teamAmounts = new Map(teamIds.map((id) => [id, 1000]));
    log('creación real: 30 organizadores de 1000');
    const createTeam = await tryCreate(
      db,
      raw,
      adminId,
      'Invitation 30x1000',
      teamUsers,
      teamAmounts,
      0,
    );
    log(createTeam);

    const chiefId = await insertUser(raw, 'CHIEF_ORGANIZER');
    const subordinateIds: string[] = [];
    for (let i = 0; i < ORGANIZERS; i++) {
      subordinateIds.push(
        await insertUser(raw, 'ORGANIZER', { chiefOrganizerId: chiefId }),
      );
    }
    const team: Team = { chiefId, subordinateIds };
    log('seed de 30000 códigos únicos (20 organizadores de 1500)');
    const seeded = await timed(() =>
      insertInvitationEvent(raw, {
        name: 'Invitacion 30000 distribucion',
        organizers: [
          { id: chiefId, ticketAmount: 0 },
          ...subordinateIds.map((id) => ({
            id,
            ticketAmount: PER_ORGANIZER,
          })),
        ],
        usedRatio: 0,
      }),
    );
    await raw.query('ANALYZE');
    const distributionEventId = seeded.value.eventId;
    log(`seed distribución en ${Math.round(seeded.ms)} ms`);

    const before = await invitationInvariants(raw, distributionEventId);
    log('mover 30000 códigos al jefe');
    let toChief: unknown;
    try {
      toChief = await measureMove(
        db,
        raw,
        distributionEventId,
        team,
        amountsFor(team, 0, 0),
      );
    } catch (error) {
      toChief = { error: brief(error) };
    }
    log('al jefe:', JSON.stringify(toChief));

    let back: unknown = { skipped: true };
    if (toChief && typeof toChief === 'object' && !('error' in toChief)) {
      log('devolver 30000 códigos a los organizadores');
      try {
        back = await measureMove(
          db,
          raw,
          distributionEventId,
          team,
          amountsFor(team, PER_ORGANIZER, 0),
        );
      } catch (error) {
        back = { error: brief(error) };
      }
      log('de vuelta:', JSON.stringify(back));
    }

    let concurrent: unknown;
    const restored =
      back &&
      typeof back === 'object' &&
      !('error' in back) &&
      !('skipped' in back);
    if (
      restored ||
      (toChief && typeof toChief === 'object' && 'error' in toChief)
    ) {
      const inputA = await teamInput(
        raw,
        team,
        new Map([
          ...subordinateIds.map(
            (id, index) =>
              [id, index < 10 ? PER_ORGANIZER - 200 : PER_ORGANIZER] as const,
          ),
          [chiefId, 0],
        ]),
      );
      const inputB = await teamInput(
        raw,
        team,
        new Map([
          ...subordinateIds.map(
            (id, index) =>
              [id, index >= 10 ? PER_ORGANIZER - 100 : PER_ORGANIZER] as const,
          ),
          [chiefId, 0],
        ]),
      );
      const results = await Promise.allSettled([
        applyChiefOrganizerInvitationDistribution(db, {
          chiefOrganizerId: chiefId,
          eventId: distributionEventId,
          organizersInput: inputA,
        }),
        applyChiefOrganizerInvitationDistribution(db, {
          chiefOrganizerId: chiefId,
          eventId: distributionEventId,
          organizersInput: inputB,
        }),
      ]);
      concurrent = {
        tabA: 'quita 200 a organizadores 1-10',
        tabB: 'quita 100 a organizadores 11-20',
        outcomes: results.map((result) =>
          result.status === 'fulfilled'
            ? 'ok'
            : `error: ${brief(result.reason)}`,
        ),
        invariants: await invitationInvariants(raw, distributionEventId),
      };
      log('dos pestañas:', JSON.stringify(concurrent));
    } else {
      concurrent = {
        skipped:
          'la redistribución completa no dejó el evento en el estado inicial',
      };
    }

    const free = (
      await raw.query(
        `SELECT code FROM "ticketXOrganizer"
         WHERE "eventId" = $1 AND "ticketId" IS NULL
         ORDER BY code
         LIMIT 40`,
        [distributionEventId],
      )
    ).rows.map((row) => row.code as string);
    const publicCaller = callerFor(db);
    resetQueryCount();
    const redemptionWall = await timed(() =>
      runPool(free.length, 20, (index) =>
        redeemInvitation(publicCaller, db, {
          eventId: distributionEventId,
          slug: seeded.value.slug,
          code: free[index]!,
          guestIndex: index,
        }),
      ),
    );
    const redeemed = redemptionWall.value.filter(
      (result) =>
        result.status === 'fulfilled' && result.value.status === 'redeemed',
    ).length;
    const firstRejection = redemptionWall.value.find(
      (result) => result.status === 'rejected',
    );
    const redemption = {
      attempted: free.length,
      concurrency: 20,
      redeemed,
      wallMs: Math.round(redemptionWall.ms),
      failed: redemptionWall.value.filter(
        (result) => result.status === 'rejected',
      ).length,
      sampleError:
        firstRejection?.status === 'rejected'
          ? brief(firstRejection.reason)
          : undefined,
      otherStatuses: countBy(
        redemptionWall.value.filter(
          (result) =>
            result.status === 'fulfilled' && result.value.status !== 'redeemed',
        ),
        (result) =>
          result.status === 'fulfilled' ? result.value.status : 'rejected',
      ),
      queries: getQueryCount(),
      invariants: await invitationInvariants(raw, distributionEventId),
    };
    log('canje:', JSON.stringify(redemption));

    const existingAfterSeed = (
      await raw.query(`SELECT count(*)::int AS n FROM "ticketXOrganizer"`)
    ).rows[0].n as number;
    log(
      `creación real de otro evento de 2000 con ${existingAfterSeed} códigos ya existentes`,
    );
    const createWithHistory = await tryCreate(
      db,
      raw,
      adminId,
      'Invitation 2000 con historial',
      single,
      new Map([[singleId, 2000]]),
      existingAfterSeed,
    );
    log(createWithHistory);

    log('seed de 30000 invitaciones ya canjeadas para escanear');
    const scanSeed = await timed(() =>
      insertInvitationEvent(raw, {
        name: 'Invitacion 30000 puerta',
        organizers: [
          { id: chiefId, ticketAmount: 0 },
          ...subordinateIds.map((id) => ({
            id,
            ticketAmount: PER_ORGANIZER,
          })),
        ],
        usedRatio: 1,
      }),
    );
    await raw.query('ANALYZE');
    log(`seed escaneo en ${Math.round(scanSeed.ms)} ms`);
    const scan = await scanGuests(db, raw, scanSeed.value.eventId, log);
    log('escaneo:', JSON.stringify(scan));

    const admin = callerFor(db, { id: adminId, role: 'ADMIN' });
    resetQueryCount();
    let ticketTable: unknown;
    try {
      const listed = await timed(() =>
        admin.emittedTickets.getByEventId({ eventId: scanSeed.value.eventId }),
      );
      ticketTable = {
        ms: Math.round(listed.ms),
        queries: getQueryCount(),
        rows: Array.isArray(listed.value) ? listed.value.length : null,
        payloadMB: Math.round((payloadBytes(listed.value) / 1e6) * 100) / 100,
      };
    } catch (error) {
      ticketTable = { error: brief(error) };
    }
    log('tabla de tickets:', JSON.stringify(ticketTable));

    return {
      database: dbName,
      postgres: settings.rows[0],
      notes: {
        tenant: 'single',
        rttMs: 0,
        emails: 0,
        s3: 0,
        pdfs: 0,
      },
      createOneOrganizer: createOne,
      createTeamOf30: createTeam,
      distributionSeedMs: Math.round(seeded.ms),
      invariantsBeforeMove: before,
      moveAllToChief: toChief,
      moveAllBack: back,
      concurrentSaves: concurrent,
      redemption,
      createAnotherEventWithExistingCodes: createWithHistory,
      scanSeedMs: Math.round(scanSeed.ms),
      scan,
      ticketTable,
    };
  } finally {
    await close();
  }
}
