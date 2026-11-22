// Pruebas de regresión de los hallazgos del enjambre (tests/swarm/RESULTADOS.md)
// contra el stack simulado, llamando a los routers reales con la base local.
// Con el stack levantado (tests/stack/up.sh --reseed):
//   source tests/stack/.run/env.sh && node --import tsx \
//     --import ./tests/load/register-phone-metadata.mjs \
//     --import ./tests/stack/preload.mjs tests/stack/regressions.ts
import '@tests/load/bootstrap';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { TRPCError } from '@trpc/server';
import { Pool } from 'pg';

import { createDb, type Db } from '@/drizzle';

import { mapEventOrganizersToSchema } from '@/lib/event-organizers';
import { loadUserAccess } from '@/server/rbac/access';
import { appRouter } from '@/server/routers/app';
import { createManyTicketSchema } from '@/server/schemas/emitted-tickets';
import { organizerInvitationSchema } from '@/server/schemas/organizer';
import { userSchema } from '@/server/schemas/user';
import {
  lockDurationMs,
  loginLockedMinutes,
  registerFailedLogin,
  registerSuccessfulLogin,
  TENANT_LOGIN_ATTEMPTS,
} from '@/server/security/login-throttle';
import {
  getTransferAlias,
  setTransferAlias,
} from '@/server/services/paymentSettings';
import { markGroupPaid } from '@/server/services/ticketGroup';
import { createCallerFactory } from '@/server/trpc';
import { encryptString } from '@/server/utils/utils';

const createCaller = createCallerFactory(appRouter);
const RUN = process.env.STACK_RUN_DIR!;
const DB_URL = `${process.env.PG_BASE}/tenant_1_prueba`;
const NEXT = `http://127.0.0.1:${process.env.STACK_NEXT_PORT ?? 3100}`;

type Caller = ReturnType<typeof createCaller>;
type SeedEvent = {
  key: string;
  id: string;
  slug: string;
  ticketTypes: {
    id: string;
    name: string;
    price: number;
    maxAvailable: number;
  }[];
};

const results: { id: string; ok: boolean; detail: string }[] = [];

async function check(id: string, title: string, run: () => Promise<void>) {
  try {
    await run();
    results.push({ id, ok: true, detail: title });
    console.log(`✓ ${id} ${title}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ id, ok: false, detail: `${title}: ${detail}` });
    console.log(`✗ ${id} ${title}\n    ${detail}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function rejects(promise: Promise<unknown>, code: TRPCError['code']) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TRPCError && error.code === code) return error;
    throw new Error(
      `esperaba ${code}, salió ${error instanceof TRPCError ? error.code : String(error)}`,
    );
  }
  throw new Error(`esperaba ${code} y no falló`);
}

// Datos propios de cada corrida: los mails se cuentan por destinatario.
const RUN_ID = Date.now().toString(36);
let buyerSeq = 0;
function buyer(ticketTypeId: string, ticketGroupId: string, eventId: string) {
  buyerSeq += 1;
  return {
    fullName: `Regresión ${buyerSeq}`,
    dni: String(70_000_000 + buyerSeq),
    mail: `regresion-${RUN_ID}-${buyerSeq}@regresiones.pn.test`,
    gender: 'other',
    phoneNumber: '+5491155550000',
    instagram: '',
    birthDate: new Date('1995-06-15'),
    paidOnLocation: false,
    ticketTypeId,
    ticketGroupId,
    eventId,
  };
}

function mailsTo(address: string) {
  return readdirSync(path.join(RUN, 'mails'))
    .filter((file) => file.endsWith('.json'))
    .map(
      (file) =>
        JSON.parse(readFileSync(path.join(RUN, 'mails', file), 'utf8')) as {
          to: string | string[];
        },
    )
    .filter((mail) => [mail.to].flat().includes(address)).length;
}

/** El aviso de pago firmado, como lo manda Pluto (y el Mercado Pago simulado). */
async function paymentWebhook(
  instance: ResolvedInstance,
  ticketGroupId: string,
) {
  const body = JSON.stringify({ ticketGroupId });
  const timestamp = String(Date.now());
  const signature = createHmac(
    'sha256',
    process.env.CREDENTIALS_SIGNING_SECRET!,
  )
    .update(`${timestamp}.${body}`)
    .digest('hex');
  const host = new URL(instance.publicUrl).host;
  const response = await fetch(`${NEXT}/api/mercadopago`, {
    method: 'POST',
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
      'content-type': 'application/json',
      'x-timestamp': timestamp,
      'x-signature': `sha256=${signature}`,
    },
    body,
  });
  return response.status;
}

async function main() {
  const seed = JSON.parse(readFileSync(path.join(RUN, 'seed.json'), 'utf8'));
  const events = new Map<string, SeedEvent>(
    (seed.tenants.prueba.events as SeedEvent[]).map((event) => [
      event.key,
      event,
    ]),
  );
  const event = (key: string) => events.get(key)!;
  const type = (key: string, name: string) =>
    event(key).ticketTypes.find((t) => t.name === name)!;

  const raw = new Pool({ connectionString: DB_URL, max: 2 });
  const db: Db = createDb(DB_URL, { max: 4 });
  const control = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL,
  });
  const {
    rows: [tenant],
  } = await control.query<{ id: number; mp: string }>(
    `SELECT id, mp_access_token AS mp FROM tenants WHERE slug = 'prueba'`,
  );
  await control.end();
  const url = `https://prueba.${process.env.ROOT_DOMAIN}`;
  const instance: ResolvedInstance = {
    tenantId: tenant.id,
    slug: 'prueba',
    name: 'Prueba Producciones',
    publicUrl: url,
    siteUrl: url,
    contactEmail: 'contacto@prueba.pn.test',
    description: null,
    faviconUrl: null,
    hue: 265,
    saturation: 80,
    mercadoPagoAccessToken: tenant.mp,
    mercadoPagoRefreshToken: null,
    database: { name: 'tenant_1_prueba' },
  };

  const users = new Map(
    (
      await raw.query<{ id: string; name: string; role: string }>(
        'SELECT id, name, role FROM "user"',
      )
    ).rows.map((user) => [user.name, user]),
  );
  const callerFor = (username: string | null): Caller => {
    const user = username ? users.get(username)! : null;
    let access: ReturnType<typeof loadUserAccess> | undefined;
    return createCaller({
      db,
      instance,
      session: user
        ? {
            expires: new Date(Date.now() + 3_600_000).toISOString(),
            user: {
              id: user.id,
              role: user.role,
              name: user.name,
              email: `${user.name}@prueba.pn.test`,
              fullName: user.name,
              tenantSlug: 'prueba',
              emailVerified: null,
              image: null,
            },
          }
        : null,
      headers: new Headers(),
      getAccess: () =>
        user ? (access ??= loadUserAccess(db, user.id)) : Promise.resolve(null),
    } as never);
  };
  const anon = callerFor(null);
  const admin = callerFor('admin');
  const puerta = callerFor('puerta');

  const groupExists = async (id: string) =>
    (await raw.query('SELECT 1 FROM "ticketGroup" WHERE id = $1', [id]))
      .rowCount === 1;
  const holdsQuota = async (id: string) =>
    ((
      await raw.query(
        'SELECT 1 FROM "ticketTypePerGroup" WHERE "ticketGroupId" = $1',
        [id],
      )
    ).rowCount ?? 0) > 0;
  const age = (id: string, minutes: number) =>
    raw.query(
      `UPDATE "ticketGroup" SET "createdAt" = now() - make_interval(mins => $2) WHERE id = $1`,
      [id, minutes],
    );
  const releaseHolds = (slug: string) => anon.events.getPublicBySlug(slug);
  const reserve = (key: string, name: string, amount = 1, previous?: string) =>
    anon.ticketGroup.create({
      eventId: event(key).id,
      ticketsPerType: [{ ticketTypeId: type(key, name).id, amount }],
      invitedBy: null,
      previousTicketGroupId: previous ?? null,
    });

  await check(
    'H07',
    'una reserva sin pagar se suelta a los 10 minutos',
    async () => {
      const group = await reserve('fiesta-paga', 'General');
      await age(group, 11);
      await releaseHolds(event('fiesta-paga').slug);
      assert(
        !(await groupExists(group)),
        'la reserva vencida sigue en la base',
      );
    },
  );

  await check(
    'H07',
    'volver a tocar CONTINUAR suelta la reserva anterior',
    async () => {
      const first = await reserve('fiesta-paga', 'General');
      const second = await reserve('fiesta-paga', 'General', 2, first);
      assert(
        !(await groupExists(first)),
        'la primera reserva sigue tomando cupo',
      );
      assert(await groupExists(second), 'falta la reserva nueva');
    },
  );

  await check(
    'H01',
    'una compra en Mercado Pago no se borra a los 10 minutos y un pago tardío entrega igual',
    async () => {
      const e = event('fiesta-paga');
      const general = type('fiesta-paga', 'General');
      const group = await reserve('fiesta-paga', 'General');
      const ticket = buyer(general.id, group, e.id);
      await anon.emittedTickets.createMany([ticket]);
      await raw.query(
        `UPDATE "ticketGroup" SET "paymentMethod" = 'MERCADO_PAGO' WHERE id = $1`,
        [group],
      );
      await age(group, 15);
      await releaseHolds(e.slug);
      assert(await holdsQuota(group), 'a los 15 min ya no retiene el cupo');
      await age(group, 45);
      await releaseHolds(e.slug);
      assert(await groupExists(group), 'a los 45 min se borró el grupo');
      assert(
        !(await holdsQuota(group)),
        'a los 45 min sigue reteniendo el cupo',
      );

      assert(
        (await paymentWebhook(instance, group)) === 200,
        'el aviso no dio 200',
      );
      const {
        rows: [after],
      } = await raw.query<{ status: string }>(
        'SELECT status FROM "ticketGroup" WHERE id = $1',
        [group],
      );
      assert(after.status === 'PAID', `quedó ${after.status}`);
      assert(await holdsQuota(group), 'el pago tardío no recuperó el cupo');
      assert(mailsTo(ticket.mail) === 1, `mails: ${mailsTo(ticket.mail)}`);
    },
  );

  await check(
    'H21',
    'un aviso de pago repetido no vuelve a mandar las entradas',
    async () => {
      const e = event('fiesta-paga');
      const general = type('fiesta-paga', 'General');
      const group = await reserve('fiesta-paga', 'General');
      const ticket = buyer(general.id, group, e.id);
      await anon.emittedTickets.createMany([ticket]);
      await raw.query(
        `UPDATE "ticketGroup" SET "paymentMethod" = 'MERCADO_PAGO' WHERE id = $1`,
        [group],
      );
      const statuses = await Promise.all([
        paymentWebhook(instance, group),
        paymentWebhook(instance, group),
        paymentWebhook(instance, group),
      ]);
      assert(
        statuses.every((s) => s === 200),
        `estados ${statuses.join(',')}`,
      );
      assert(mailsTo(ticket.mail) === 1, `mails: ${mailsTo(ticket.mail)}`);
      assert(
        (await markGroupPaid(db, group)) === false,
        'un cuarto aviso volvió a registrar el pago',
      );
    },
  );

  await check(
    'H01',
    'la preferencia vence y vuelve siempre a la página de la compra',
    async () => {
      const e = event('ultimas-entradas');
      const group = await reserve('ultimas-entradas', 'Anticipada');
      await anon.emittedTickets.createMany([
        buyer(type('ultimas-entradas', 'Anticipada').id, group, e.id),
      ]);
      const initPoint = await anon.mercadoPago.createPreference({
        ticketGroupId: group,
      });
      const prefId = new URL(initPoint).searchParams.get('pref_id');
      const pref = JSON.parse(
        readFileSync(path.join(RUN, 'mp', `${prefId}.json`), 'utf8'),
      );
      assert(pref.expires === true, 'la preferencia no vence');
      const minutes =
        (new Date(pref.expiration_date_to).getTime() - Date.now()) / 60_000;
      assert(
        minutes > 15 && minutes <= 20,
        `vence en ${minutes.toFixed(1)} min`,
      );
      assert(
        pref.back_urls.failure.endsWith(`/tickets/${group}`),
        `failure va a ${pref.back_urls.failure}`,
      );
      await raw.query('DELETE FROM "ticketGroup" WHERE id = $1', [group]);
    },
  );

  await check(
    'MEDIOS',
    'el comprador elige el medio, puede cambiarlo y no queda sin medios activos',
    async () => {
      const previousAlias = await getTransferAlias(db);
      await setTransferAlias(db, 'prueba.regresion.mp');
      try {
        const options = await anon.payments.checkoutOptions();
        assert(
          options.map((o) => o.method).join(',') === 'MERCADO_PAGO,TRANSFER',
          `opciones ${options.map((o) => o.method).join(',')}`,
        );

        const e = event('fiesta-paga');
        const group = await reserve('fiesta-paga', 'General');
        await anon.emittedTickets.createMany([
          buyer(type('fiesta-paga', 'General').id, group, e.id),
        ]);
        const methodOf = async () =>
          (
            await raw.query<{ m: string | null }>(
              'SELECT "paymentMethod" AS m FROM "ticketGroup" WHERE id = $1',
              [group],
            )
          ).rows[0]?.m;

        const transfer = await anon.payments.start({
          ticketGroupId: group,
          method: 'TRANSFER',
        });
        assert(transfer.type === 'instructions', 'transferencia sin datos');
        assert((await methodOf()) === 'TRANSFER', 'no quedó en transferencia');
        const info = await anon.ticketGroup.getPendingPaymentInfo(group);
        assert(
          info?.otherPaymentMethods.some((o) => o.method === 'MERCADO_PAGO') ===
            true,
          'no ofrece pasar a Mercado Pago',
        );

        const mp = await anon.payments.start({
          ticketGroupId: group,
          method: 'MERCADO_PAGO',
        });
        assert(mp.type === 'redirect', 'Mercado Pago sin link');
        assert((await methodOf()) === 'MERCADO_PAGO', 'no pasó a Mercado Pago');

        // Una transferencia vieja no puede pasar a Mercado Pago: soltaría el
        // cupo apenas se crea la preferencia.
        await raw.query(
          `UPDATE "ticketGroup" SET "paymentMethod" = 'TRANSFER' WHERE id = $1`,
          [group],
        );
        await age(group, 41);
        const late = await anon.ticketGroup.getPendingPaymentInfo(group);
        assert(
          late?.otherPaymentMethods.length === 0,
          `ofrece ${late?.otherPaymentMethods.map((o) => o.method)}`,
        );
        await rejects(
          anon.payments.start({ ticketGroupId: group, method: 'MERCADO_PAGO' }),
          'PRECONDITION_FAILED',
        );

        // Pausada, la transferencia no se ofrece ni se puede iniciar.
        await admin.payments.setEnabled({ method: 'TRANSFER', enabled: false });
        try {
          assert(
            !(await anon.payments.checkoutOptions()).some(
              (o) => o.method === 'TRANSFER',
            ),
            'ofrece la transferencia pausada',
          );
          await rejects(
            anon.payments.start({ ticketGroupId: group, method: 'TRANSFER' }),
            'PRECONDITION_FAILED',
          );
          // Con eventos pagos, Mercado Pago queda como único activo.
          await rejects(
            admin.payments.setEnabled({
              method: 'MERCADO_PAGO',
              enabled: false,
            }),
            'PRECONDITION_FAILED',
          );
        } finally {
          await admin.payments.setEnabled({
            method: 'TRANSFER',
            enabled: true,
          });
        }
        await raw.query('DELETE FROM "ticketGroup" WHERE id = $1', [group]);
      } finally {
        await setTransferAlias(db, previousAlias);
      }
    },
  );

  await check(
    'TALO',
    'Conectar con Talo por OAuth, un CVU por compra y entrega sólo con el pago completo',
    async () => {
      const before = await admin.payments.taloConnection();
      assert(before.enabled, 'Talo no está habilitado en el stack');
      assert(before.connection === null, 'ya había una cuenta conectada');

      // Sin haber tocado "Conectar con Talo", un código ajeno no conecta.
      await rejects(
        admin.payments.completeTaloConnect({
          code: 'code-ajeno',
          referredUserId: 'prueba',
        }),
        'PRECONDITION_FAILED',
      );

      // La persona toca Conectar, autoriza en Talo y vuelve con un código.
      const authorize = async (status: 'ACTIVE' | 'PENDING') => {
        const { url: authorizeUrl } = await admin.payments.startTaloConnect();
        assert(
          authorizeUrl.startsWith(
            `${process.env.TALO_APP_URL}/authorize/${process.env.TALO_PARTNER_ID}`,
          ),
          `autoriza en ${authorizeUrl}`,
        );
        assert(
          new URL(authorizeUrl).searchParams.get('referred_user_id') ===
            'prueba',
          'no manda la plataforma en referred_user_id',
        );
        const authorized = await fetch(authorizeUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ status }).toString(),
          redirect: 'manual',
        });
        const back = new URL(authorized.headers.get('location')!);
        assert(
          back.origin + back.pathname === process.env.TALO_REDIRECT_URL,
          `Talo vuelve a ${back}`,
        );
        return back;
      };

      const back = await authorize('ACTIVE');
      const code = back.searchParams.get('code')!;

      // El callback del dominio raíz rebota a la plataforma con el código.
      const rootHost = process.env.ROOT_DOMAIN!;
      const bounce = await fetch(`${NEXT}${back.pathname}${back.search}`, {
        headers: {
          host: rootHost,
          'x-forwarded-host': rootHost,
          'x-forwarded-proto': 'https',
        },
        redirect: 'manual',
      });
      const bounced = new URL(bounce.headers.get('location') ?? 'about:blank');
      assert(
        bounce.status === 303 &&
          bounced.host === new URL(instance.publicUrl).host &&
          bounced.pathname === '/admin/settings/talo' &&
          bounced.searchParams.get('code') === code,
        `el callback va a ${bounce.status} ${bounced}`,
      );

      // Otra persona del staff no puede completar la conexión que empezó admin.
      await rejects(
        callerFor('admin2').payments.completeTaloConnect({
          code,
          referredUserId: 'prueba',
        }),
        'PRECONDITION_FAILED',
      );
      const done = await admin.payments.completeTaloConnect({
        code,
        referredUserId: 'prueba',
      });
      assert(done.status === 'ACTIVE', `estado ${done.status}`);
      const connected = await admin.payments.taloConnection();
      assert(connected.connection?.status === 'ACTIVE', 'no quedó conectada');
      const taloUser = connected.connection!.userId;

      try {
        const talo = (await anon.payments.checkoutOptions()).find(
          (o) => o.method === 'TALO',
        );
        assert(talo?.label === 'Transferencia inmediata', 'no ofrece Talo');

        const e = event('fiesta-paga');
        const group = await reserve('fiesta-paga', 'General');
        const ticket = buyer(type('fiesta-paga', 'General').id, group, e.id);
        await anon.emittedTickets.createMany([ticket]);

        const start = await anon.payments.start({
          ticketGroupId: group,
          method: 'TALO',
        });
        assert(
          start.type === 'instructions' && Boolean(start.cvu),
          'Talo sin CVU',
        );
        const cvu = start.type === 'instructions' ? start.cvu! : '';
        const amount = start.type === 'instructions' ? start.amount : 0;
        const payment = JSON.parse(
          readFileSync(
            path.join(
              RUN,
              'talo',
              `${encodeURIComponent(`VAR-${taloUser}-${group}`)}.json`,
            ),
            'utf8',
          ),
        );
        assert(
          payment.partner_id === process.env.TALO_PARTNER_ID,
          'el cobro no lleva el partner_id',
        );

        const again = await anon.payments.start({
          ticketGroupId: group,
          method: 'TALO',
        });
        assert(
          again.type === 'instructions' && again.cvu === cvu,
          'generó otro CVU',
        );

        const faucet = (value: number) =>
          fetch(`https://sandbox-api.talo.com.ar/cvu/${cvu}/faucet`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ amount: value }),
          }).then((r) => r.json());
        const statusOf = async () =>
          (
            await raw.query<{ status: string }>(
              'SELECT status FROM "ticketGroup" WHERE id = $1',
              [group],
            )
          ).rows[0]?.status;

        const partial = await faucet(amount - 100);
        assert(
          partial.data.payment_status === 'UNDERPAID',
          `faucet: ${JSON.stringify(partial.data)}`,
        );
        assert(partial.data.webhook?.status === 200, 'el aviso parcial falló');
        assert((await statusOf()) === 'BOOKED', 'entregó con un pago parcial');

        const rest = await faucet(100);
        assert(rest.data.payment_status === 'SUCCESS', 'no completó el pago');
        assert(rest.data.webhook?.status === 200, 'el aviso del pago falló');
        assert((await statusOf()) === 'PAID', 'no quedó pagada');
        assert(mailsTo(ticket.mail) >= 1, 'no mandó las entradas');

        const host = new URL(instance.publicUrl).host;
        const unknown = await fetch(`${NEXT}/api/payments/talo`, {
          method: 'POST',
          headers: {
            host,
            'x-forwarded-host': host,
            'x-forwarded-proto': 'https',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ paymentId: 'VAR-desconocido' }),
        });
        assert(unknown.status === 200, `aviso desconocido: ${unknown.status}`);

        await raw.query('DELETE FROM "ticketGroup" WHERE id = $1', [group]);
      } finally {
        await admin.payments.removeTaloConnection();
      }
      assert(
        !(await anon.payments.checkoutOptions()).some(
          (o) => o.method === 'TALO',
        ),
        'Talo sigue ofrecido sin conexión',
      );

      // Una cuenta que Talo todavía verifica queda conectada pero no se ofrece.
      const pendingBack = await authorize('PENDING');
      const pending = await admin.payments.completeTaloConnect({
        code: pendingBack.searchParams.get('code')!,
        referredUserId: 'prueba',
      });
      try {
        assert(pending.status === 'PENDING', `estado ${pending.status}`);
        assert(
          !(await anon.payments.checkoutOptions()).some(
            (o) => o.method === 'TALO',
          ),
          'ofrece Talo con la cuenta en verificación',
        );
      } finally {
        await admin.payments.removeTaloConnection();
      }
    },
  );

  await check(
    'TALO-DIF',
    'Talo: tolerancia, pago de menos (aceptar o devolver), de más y tardío',
    async () => {
      // Conecta Talo como lo haría la productora.
      await admin.payments
        .startTaloConnect()
        .then(async ({ url: authorizeUrl }) => {
          const authorized = await fetch(authorizeUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ status: 'ACTIVE' }).toString(),
            redirect: 'manual',
          });
          const back = new URL(authorized.headers.get('location')!);
          await admin.payments.completeTaloConnect({
            code: back.searchParams.get('code')!,
            referredUserId: 'prueba',
          });
        });
      const contact = 'contacto@prueba.pn.test';
      const e = event('fiesta-paga');

      type Talo = { cvu: string; amount: number };
      const buy = async () => {
        const group = await reserve('fiesta-paga', 'General');
        const ticket = buyer(type('fiesta-paga', 'General').id, group, e.id);
        await anon.emittedTickets.createMany([ticket]);
        const start = await anon.payments.start({
          ticketGroupId: group,
          method: 'TALO',
        });
        assert(start.type === 'instructions' && start.cvu, 'sin CVU');
        const talo: Talo = {
          cvu: start.type === 'instructions' ? start.cvu! : '',
          amount: start.type === 'instructions' ? start.amount : 0,
        };
        return { group, ticket, talo };
      };
      const faucet = (cvu: string, value: number) =>
        fetch(`https://sandbox-api.talo.com.ar/cvu/${cvu}/faucet`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ amount: value }),
        }).then((r) => r.json());
      const row = async (group: string) => {
        const { rows } = await raw.query<{
          status: string;
          details: {
            received?: number;
            issue?: string | null;
            refund?: { status: string; amount: number; type: string } | null;
          };
          total: string;
        }>(
          'SELECT status, "paymentDetails" AS details, "totalAmount" AS total FROM "ticketGroup" WHERE id = $1',
          [group],
        );
        return rows[0];
      };
      const purchaseOf = async (group: string) =>
        (await admin.ticketGroup.getPurchasesByEvent(e.id)).find(
          (purchase) => purchase.id === group,
        );

      try {
        // Tolerancia: $5 menos cuenta como completo.
        const tolerated = await buy();
        await faucet(tolerated.talo.cvu, tolerated.talo.amount - 5);
        const toleratedRow = await row(tolerated.group);
        assert(
          toleratedRow.status === 'PAID',
          'no entregó dentro de la tolerancia',
        );
        assert(
          !toleratedRow.details.issue,
          'marcó diferencia dentro de la tolerancia',
        );

        // De menos → el comprador ve cuánto falta → el organizador acepta.
        const under = await buy();
        const contactBefore = mailsTo(contact);
        const buyerBefore = mailsTo(under.ticket.mail);
        const partial = await faucet(under.talo.cvu, under.talo.amount - 1000);
        assert(
          partial.data.webhook?.status === 200,
          'falló el aviso de pago de menos',
        );
        let underRow = await row(under.group);
        assert(underRow.status === 'BOOKED', 'entregó un pago de menos');
        assert(
          underRow.details.issue === 'UNDERPAID',
          `issue ${underRow.details.issue}`,
        );
        assert(mailsTo(contact) === contactBefore + 1, 'no avisó al contacto');
        assert(
          mailsTo(under.ticket.mail) === buyerBefore + 1,
          'no avisó al comprador',
        );
        const info = await anon.ticketGroup.getPendingPaymentInfo(under.group);
        assert(
          info?.transferAccount?.received === under.talo.amount - 1000,
          'el comprador no ve lo recibido',
        );
        // Un segundo aviso igual no repite el mail al contacto.
        await faucet(under.talo.cvu, 1);
        assert(
          mailsTo(contact) === contactBefore + 1,
          'repitió el mail al contacto',
        );
        await admin.payments.taloAcceptUnderpaid({
          ticketGroupId: under.group,
        });
        underRow = await row(under.group);
        assert(underRow.status === 'PAID', 'aceptar no entregó');
        assert(
          Number(underRow.total) === under.talo.amount - 999,
          `total ${underRow.total}`,
        );

        // De menos → el organizador cancela y devuelve todo.
        const cancel = await buy();
        await faucet(cancel.talo.cvu, cancel.talo.amount - 2000);
        await admin.payments.taloRefund({ ticketGroupId: cancel.group });
        let cancelRow = await row(cancel.group);
        assert(
          cancelRow.details.refund?.type === 'FULL' &&
            cancelRow.details.refund.amount === cancel.talo.amount - 2000,
          `devolución ${JSON.stringify(cancelRow.details.refund)}`,
        );
        assert(!(await holdsQuota(cancel.group)), 'no liberó las entradas');
        await rejects(
          admin.payments.taloRefund({ ticketGroupId: cancel.group }),
          'PRECONDITION_FAILED',
        );
        // Talo no avisa cuando termina: se lee al listar las compras.
        await purchaseOf(cancel.group);
        const refunded = await purchaseOf(cancel.group);
        assert(
          refunded?.talo?.refund?.status === 'SUCCESS',
          `estado ${refunded?.talo?.refund?.status}`,
        );
        cancelRow = await row(cancel.group);
        assert(
          cancelRow.status === 'BOOKED',
          'la compra cancelada quedó pagada',
        );

        // De más → se entrega y se devuelve la diferencia.
        const over = await buy();
        await faucet(over.talo.cvu, over.talo.amount + 500);
        let overRow = await row(over.group);
        assert(overRow.status === 'PAID', 'no entregó un pago de más');
        assert(
          overRow.details.issue === 'OVERPAID',
          `issue ${overRow.details.issue}`,
        );
        await admin.payments.taloRefund({ ticketGroupId: over.group });
        overRow = await row(over.group);
        assert(
          overRow.details.refund?.type === 'PARTIAL' &&
            overRow.details.refund.amount === 500,
          `devolución ${JSON.stringify(overRow.details.refund)}`,
        );

        // Tardío: la reserva ya soltó el cupo → no se entrega, se devuelve solo.
        const late = await buy();
        await raw.query(
          'DELETE FROM "ticketTypePerGroup" WHERE "ticketGroupId" = $1',
          [late.group],
        );
        const lateContact = mailsTo(contact);
        await faucet(late.talo.cvu, late.talo.amount);
        const lateRow = await row(late.group);
        assert(lateRow.status === 'BOOKED', 'entregó un pago tardío');
        assert(
          lateRow.details.issue === 'LATE',
          `issue ${lateRow.details.issue}`,
        );
        assert(
          lateRow.details.refund?.type === 'FULL',
          'no pidió la devolución',
        );
        assert(
          mailsTo(contact) === lateContact + 1,
          'no avisó al contacto del tardío',
        );
        const lateInfo = await anon.ticketGroup.getPendingPaymentInfo(
          late.group,
        );
        assert(
          lateInfo?.transferAccount?.expired === true &&
            lateInfo.transferAccount.refunding === true,
          'el comprador no ve que venció y se devuelve',
        );

        for (const group of [tolerated, under, cancel, over, late]) {
          await raw.query('DELETE FROM "ticketGroup" WHERE id = $1', [
            group.group,
          ]);
        }
      } finally {
        await admin.payments.removeTaloConnection();
      }
    },
  );

  await check(
    'BLOQUEO',
    'oculto se entra por link; bloqueado no entra nadie del público',
    async () => {
      // Oculto (isActive = false) sólo sale del listado.
      assert(
        (await anon.events.getPublicBySlug(event('borrador').slug)) !== null,
        'un evento oculto no se ve por link',
      );

      const e = event('fiesta-paga');
      const pending = await reserve('fiesta-paga', 'General');
      await raw.query('UPDATE event SET "isBlocked" = true WHERE id = $1', [
        e.id,
      ]);
      try {
        assert(
          (await anon.events.getPublicBySlug(e.slug)) === null,
          'bloqueado se ve sin sesión',
        );
        assert(
          (await admin.events.getPublicBySlug(e.slug)) === null,
          'bloqueado se ve con sesión de staff',
        );
        assert(
          (await puerta.events.getForScanBySlug(e.slug)) !== null,
          'el scanner no encuentra el evento bloqueado',
        );
        assert(
          !(await anon.events.getActive()).some((x) => x.id === e.id),
          'bloqueado sigue en el listado',
        );
        await rejects(reserve('fiesta-paga', 'General'), 'BAD_REQUEST');
        // La reserva hecha antes de bloquear no se completa.
        await rejects(
          anon.emittedTickets.createMany([
            buyer(type('fiesta-paga', 'General').id, pending, e.id),
          ]),
          'BAD_REQUEST',
        );
        await rejects(
          anon.mercadoPago.createPreference({ ticketGroupId: pending }),
          'BAD_REQUEST',
        );

        const inv = event('egresados');
        const {
          rows: [{ code }],
        } = await raw.query<{ code: string }>(
          `SELECT code FROM "ticketXOrganizer" WHERE "eventId" = $1 AND "ticketId" IS NULL ORDER BY "shortId" LIMIT 1`,
          [inv.id],
        );
        await raw.query('UPDATE event SET "isBlocked" = true WHERE id = $1', [
          inv.id,
        ]);
        try {
          const redeemed = await anon.ticketGroup.redeemInvitation({
            eventId: inv.id,
            code,
          });
          assert(
            redeemed.status === 'event_blocked',
            `la invitación de un evento bloqueado dio ${redeemed.status}`,
          );
        } finally {
          await raw.query(
            'UPDATE event SET "isBlocked" = false WHERE id = $1',
            [inv.id],
          );
        }
      } finally {
        await raw.query('UPDATE event SET "isBlocked" = false WHERE id = $1', [
          e.id,
        ]);
        await raw.query('DELETE FROM "ticketGroup" WHERE id = $1', [pending]);
      }
    },
  );

  await check(
    'H10',
    'no se venden entradas de un evento terminado',
    async () => {
      await rejects(reserve('pasado', 'General'), 'BAD_REQUEST');
    },
  );

  await check('H06', 'events.getAll y getById no son públicos', async () => {
    await rejects(anon.events.getAll(), 'UNAUTHORIZED');
    await rejects(anon.events.getById(event('fiesta-paga').id), 'UNAUTHORIZED');
  });

  await check(
    'H03',
    'dos navegadores con el mismo link tienen su reserva y gana el primero que envía sus datos',
    async () => {
      const e = event('egresados');
      const {
        rows: [{ code }],
      } = await raw.query<{ code: string }>(
        `SELECT code FROM "ticketXOrganizer" WHERE "eventId" = $1 AND "ticketId" IS NULL ORDER BY "shortId" LIMIT 1`,
        [e.id],
      );
      const a = await anon.ticketGroup.redeemInvitation({
        eventId: e.id,
        code,
      });
      assert(a.status === 'ok', `primer canje: ${a.status}`);
      const again = await anon.ticketGroup.redeemInvitation({
        eventId: e.id,
        code,
        currentTicketGroupId: a.ticketGroupId,
      });
      assert(
        again.status === 'ok' && again.ticketGroupId === a.ticketGroupId,
        'el mismo navegador no reutilizó su reserva',
      );
      const b = await anon.ticketGroup.redeemInvitation({
        eventId: e.id,
        code,
      });
      assert(
        b.status === 'ok' && b.ticketGroupId !== a.ticketGroupId,
        'B compartió la reserva de A',
      );
      assert(
        await groupExists(a.ticketGroupId),
        'abrir el link en otro navegador le sacó la reserva a A',
      );

      // A abrió primero y B después, pero A le da a Adquirir primero: gana A.
      const invitation = type('egresados', 'Invitación');
      const claimA = await anon.ticketGroup.claimInvitation({
        ticketGroupId: a.ticketGroupId,
        code,
      });
      assert(claimA.status === 'ok', `reclamo de A: ${claimA.status}`);
      const holder = buyer(invitation.id, a.ticketGroupId, e.id);
      await anon.emittedTickets.createMany([holder]);

      const claimB = await anon.ticketGroup.claimInvitation({
        ticketGroupId: b.ticketGroupId,
        code,
      });
      assert(
        claimB.status === 'already_used',
        `reclamo de B después de A: ${claimB.status}`,
      );
      await rejects(
        anon.emittedTickets.createMany([
          buyer(invitation.id, b.ticketGroupId, e.id),
        ]),
        'CONFLICT',
      );
      await rejects(
        anon.emittedTickets.createMany([
          buyer(invitation.id, a.ticketGroupId, e.id),
        ]),
        'CONFLICT',
      );
      const c = await anon.ticketGroup.redeemInvitation({
        eventId: e.id,
        code,
      });
      assert(
        c.status === 'already_used',
        `canje después de usado: ${c.status}`,
      );
      const same = await anon.emittedTickets.createMany([holder]);
      assert(
        same.length === 1,
        'el reintento de quien la emitió no devolvió su entrada',
      );
    },
  );

  await check(
    'H02/H29/H31',
    'editar el evento no borra ventas ni pisa cambios más nuevos',
    async () => {
      const e = event('fiesta-paga');
      const full = (await admin.events.getBySlug(e.slug))!;
      const base = {
        event: {
          ...full,
          startingDate: full.startingDate ? new Date(full.startingDate) : null,
          endingDate: full.endingDate ? new Date(full.endingDate) : null,
          authorizedUsers: full.eventXUsers.map((x) => ({
            id: x.user.id,
            name: x.user.name,
          })),
        },
        ticketTypes: full.ticketTypes.map((t) => ({
          ...t,
          startingDate: t.startingDate ? new Date(t.startingDate) : null,
          maxSellDate: t.maxSellDate ? new Date(t.maxSellDate) : null,
          scanLimit: t.scanLimit ? new Date(t.scanLimit) : null,
          organizers: t.ticketTypeXOrganizers.map((rel) => rel.b),
        })),
        organizersInput: mapEventOrganizersToSchema(
          full.eventXorganizers,
          'TRADITIONAL',
        ),
        questions: full.eventQuestions.map((q) => ({
          id: q.id,
          text: q.text,
          isRequired: q.isRequired,
        })),
      };
      const update = (
        overrides: Partial<typeof base>,
        expectedVersion?: number,
      ) =>
        admin.events.update({
          ...base,
          ...overrides,
          expectedVersion,
        } as never);

      const withoutGeneral = base.ticketTypes.filter(
        (t) => t.name !== 'General',
      );
      const deleteError = await rejects(
        update({ ticketTypes: withoutGeneral }, full.version),
        'BAD_REQUEST',
      );
      assert(deleteError.message.includes('General'), deleteError.message);

      const lowered = base.ticketTypes.map((t) =>
        t.name === 'General' ? { ...t, maxAvailable: 1 } : t,
      );
      await rejects(
        update({ ticketTypes: lowered }, full.version),
        'BAD_REQUEST',
      );

      await raw.query('UPDATE event SET "isActive" = false WHERE id = $1', [
        e.id,
      ]);
      let after: { version: number; isActive: boolean };
      try {
        // Fuera de Next, el revalidatePath del final falla después de guardar.
        await update({}, full.version).catch((error: unknown) => {
          if (!String(error).includes('static generation store missing'))
            throw error;
        });
        ({
          rows: [after],
        } = await raw.query<{ version: number; isActive: boolean }>(
          'SELECT version, "isActive" FROM event WHERE id = $1',
          [e.id],
        ));
      } finally {
        await raw.query('UPDATE event SET "isActive" = true WHERE id = $1', [
          e.id,
        ]);
      }
      assert(after.version === full.version + 1, `versión ${after.version}`);
      assert(after.isActive === false, 'guardar reactivó el evento');
      await rejects(update({}, full.version), 'CONFLICT');
    },
  );

  await check(
    'H04/H05/H08/H22',
    'la emisión manual respeta cupo, cobro e ingreso',
    async () => {
      const e = event('fiesta-paga');
      const vip = type('fiesta-paga', 'VIP');
      const manual = (extra: Record<string, unknown>) => {
        const ticket = buyer(vip.id, '', e.id);
        return admin.emittedTickets.create({
          fullName: ticket.fullName,
          dni: ticket.dni,
          mail: ticket.mail,
          gender: 'female',
          phoneNumber: ticket.phoneNumber,
          birthDate: ticket.birthDate,
          eventId: e.id,
          ticketTypeId: vip.id,
          paidOnLocation: true,
          ...extra,
        });
      };
      const paid = await manual({});
      const {
        rows: [paidGroup],
      } = await raw.query<{
        status: string;
        method: string;
        total: string;
        scanned: boolean;
      }>(
        `SELECT g.status, g."paymentMethod" AS method, g."totalAmount" AS total, t.scanned
       FROM "emittedTicket" t JOIN "ticketGroup" g ON g.id = t."ticketGroupId" WHERE t.id = $1`,
        [paid.id],
      );
      assert(!paidGroup.scanned, 'nació escaneada');
      assert(
        paidGroup.status === 'PAID' && paidGroup.method === 'ON_SITE',
        `${paidGroup.status} ${paidGroup.method}`,
      );
      assert(Number(paidGroup.total) === vip.price, `total ${paidGroup.total}`);

      const unpaid = await manual({ paidOnLocation: false });
      await age(unpaid.ticketGroupId, 30);
      await releaseHolds(e.slug);
      assert(
        await groupExists(unpaid.ticketGroupId),
        'la no cobrada se borró sola',
      );

      const entered = await manual({ alreadyEntered: true });
      const {
        rows: [enteredRow],
      } = await raw.query<{ scanned: boolean }>(
        'SELECT scanned FROM "emittedTicket" WHERE id = $1',
        [entered.id],
      );
      assert(enteredRow.scanned, "'Ya ingresó' no la marcó");

      const mesa = type('fiesta-paga', 'Mesa 6 personas');
      const {
        rows: [{ taken }],
      } = await raw.query<{ taken: number }>(
        `SELECT coalesce(sum(amount), 0)::int AS taken FROM "ticketTypePerGroup" WHERE "ticketTypeId" = $1`,
        [mesa.id],
      );
      await raw.query(
        'UPDATE "ticketType" SET "maxAvailable" = $2 WHERE id = $1',
        [mesa.id, taken],
      );
      try {
        await rejects(manual({ ticketTypeId: mesa.id }), 'CONFLICT');
        await manual({ ticketTypeId: mesa.id, allowOverQuota: true });
      } finally {
        await raw.query(
          'UPDATE "ticketType" SET "maxAvailable" = $2 WHERE id = $1',
          [mesa.id, mesa.maxAvailable],
        );
      }
    },
  );

  await check(
    'H12/H45',
    'el scanner avisa fuera de horario sin quemar la entrada',
    async () => {
      const later = event('mas-tarde');
      const group = await reserve('mas-tarde', 'General');
      const [ticket] = await anon.emittedTickets.createMany([
        buyer(type('mas-tarde', 'General').id, group, later.id),
      ]);
      await raw.query(
        `UPDATE "ticketGroup" SET status = 'FREE' WHERE id = $1`,
        [group],
      );
      const barcode = encryptString(ticket.id);
      const early = await puerta.emittedTickets.scan({
        barcode,
        eventIds: [later.id],
      });
      assert(early.status === 'too-early', `salió ${early.status}`);
      const {
        rows: [row],
      } = await raw.query<{ scanned: boolean }>(
        'SELECT scanned FROM "emittedTicket" WHERE id = $1',
        [ticket.id],
      );
      assert(!row.scanned, 'quedó marcada como usada');
      const forced = await puerta.emittedTickets.scan({
        barcode,
        eventIds: [later.id],
        force: true,
      });
      assert(
        forced.status === 'success',
        `con 'Dejar pasar igual' salió ${forced.status}`,
      );

      const other = await puerta.emittedTickets.scan({
        barcode,
        eventIds: [event('en-curso').id],
      });
      assert(other.text === 'Entrada de otro evento', other.text);
    },
  );

  await check(
    'H17',
    'compartir un código que ya no es propio da NOT_FOUND',
    async () => {
      const e = event('egresados');
      const {
        rows: [{ code }],
      } = await raw.query<{ code: string }>(
        `SELECT x.code FROM "ticketXOrganizer" x JOIN "user" u ON u.id = x."organizerId"
       WHERE x."eventId" = $1 AND u.name = 'jefe' AND x."ticketId" IS NULL LIMIT 1`,
        [e.id],
      );
      await rejects(
        callerFor('orga3').organizer.setCodeShared({
          eventId: e.id,
          code,
          shared: true,
        }),
        'NOT_FOUND',
      );
    },
  );

  await check('H28', 'el reparto sólo acepta cantidades enteras', async () => {
    const result = organizerInvitationSchema.shape.ticketAmount.safeParse(2.5);
    assert(!result.success, 'aceptó 2.5');
  });

  await check(
    'H35',
    'el login se frena después de 5 intentos fallidos',
    async () => {
      const username = 'regresion-throttle';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await registerFailedLogin(db, TENANT_LOGIN_ATTEMPTS, username);
      }
      assert(
        (await loginLockedMinutes(db, TENANT_LOGIN_ATTEMPTS, username)) >= 1,
        'no se bloqueó',
      );
      await registerSuccessfulLogin(db, TENANT_LOGIN_ATTEMPTS, username);
      assert(
        (await loginLockedMinutes(db, TENANT_LOGIN_ATTEMPTS, username)) === 0,
        'no se liberó',
      );
    },
  );

  await check(
    'H35',
    'la espera crece de 1 a 15 minutos y las contraseñas nuevas piden 8 caracteres',
    async () => {
      const minutes = [5, 6, 7, 8, 9, 20].map(
        (failures) => lockDurationMs(failures) / 60_000,
      );
      assert(
        minutes.join(',') === '1,2,4,8,15,15',
        `esperas: ${minutes.join(', ')}`,
      );
      assert(lockDurationMs(4) === 0, 'frena antes del quinto intento');
      assert(
        !userSchema.shape.password.safeParse('abcd1234'.slice(0, 7)).success,
        'aceptó una contraseña de 7 caracteres',
      );
      assert(
        userSchema.shape.password.safeParse('abcd1234').success,
        'rechazó una contraseña de 8 caracteres',
      );
    },
  );

  await check(
    'H24/H47',
    'un nombre de puros espacios no pasa y el mail se guarda en minúsculas',
    async () => {
      const ticket = buyer(
        type('gratis', 'Entrada libre').id,
        '',
        event('gratis').id,
      );
      const spaces = createManyTicketSchema.safeParse([
        { ...ticket, fullName: '     ', ticketGroupId: event('gratis').id },
      ]);
      assert(!spaces.success, 'aceptó un nombre de espacios');
      const upper = createManyTicketSchema.safeParse([
        {
          ...ticket,
          mail: ' Martin.Prueba@Gmail.COM ',
          ticketGroupId: event('gratis').id,
        },
      ]);
      assert(upper.success, 'rechazó un mail válido en mayúsculas');
      assert(
        upper.data[0].mail === 'martin.prueba@gmail.com',
        `guardaría ${upper.data[0].mail}`,
      );
    },
  );

  await raw.end();
  await db.$client.end();

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} bien`);
  process.exit(failed.length ? 1 : 0);
}

void main();
