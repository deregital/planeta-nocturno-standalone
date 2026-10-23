/**
 * Compra a volumen con el mismo encadenado de procedures que usan las server
 * actions de /event/[slug] y /checkout:
 *   ticketGroup.create → emittedTickets.createMany → (pago) → status PAID/FREE
 */
import { callerFor } from '@tests/load/lib/caller';
import {
  createScenarioDatabase,
  getQueryCount,
  openLoadDb,
  resetQueryCount,
} from '@tests/load/lib/db';
import { buyerInput, insertEvent } from '@tests/load/lib/seed';
import {
  countBy,
  errorMessage,
  runPool,
  summarize,
  timed,
} from '@tests/load/lib/stats';
import { updateTicketGroupStatus } from '@/server/services/ticketGroup';

type Caller = ReturnType<typeof callerFor>;

let buyerSeq = 0;

async function purchase(
  caller: Caller,
  eventId: string,
  ticketTypeId: string,
  amount: number,
) {
  const groupId = await caller.ticketGroup.create({
    eventId,
    ticketsPerType: [{ ticketTypeId, amount }],
    invitedBy: null,
  });
  const base = (buyerSeq += 10);
  const start = performance.now();
  await caller.emittedTickets.createMany(
    Array.from({ length: amount }, (_, k) =>
      buyerInput(base + k, ticketTypeId, groupId, eventId),
    ),
  );
  return { groupId, createManyMs: performance.now() - start };
}

async function checkoutThroughput(log: (...a: unknown[]) => void) {
  const rtts = [0, 4, 20, 60];
  const checkouts = 200;
  const concurrency = 100;
  const runs: unknown[] = [];

  for (const rttMs of rtts) {
    const dbName = await createScenarioDatabase(`purchase_tp_${rttMs}`);
    const { db, raw, close } = await openLoadDb(dbName, {
      rttMs,
      poolMax: concurrency,
    });
    try {
      const { eventId, ticketTypeIds } = await insertEvent(raw, {
        name: `Throughput ${rttMs}`,
        ticketTypes: [{ name: 'General', price: 15000, maxAvailable: 10_000 }],
      });
      const [typeId] = ticketTypeIds;
      const caller = callerFor(db);

      resetQueryCount();
      const wall = await timed(() =>
        runPool(checkouts, concurrency, () =>
          purchase(caller, eventId, typeId, 2),
        ),
      );
      const ok = wall.value.filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          groupId: string;
          createManyMs: number;
        }> => r.status === 'fulfilled',
      );
      const failed = wall.value.filter((r) => r.status === 'rejected');
      const dupSlugs = await raw.query(
        `SELECT count(*)::int AS n FROM (
           SELECT slug FROM "emittedTicket" WHERE "eventId" = $1 GROUP BY slug HAVING count(*) > 1
         ) d`,
        [eventId],
      );
      const run = {
        rttMs,
        checkouts,
        concurrency,
        wallMs: Math.round(wall.ms),
        checkoutsPerSecond: Math.round((ok.length / wall.ms) * 1000 * 10) / 10,
        createManyLatency: summarize(ok.map((r) => r.value.createManyMs)),
        failed: failed.length,
        failures: countBy(failed, (r) =>
          errorMessage((r as PromiseRejectedResult).reason),
        ),
        queriesPerCheckout: Math.round((getQueryCount() / checkouts) * 10) / 10,
        duplicatedSlugs: dupSlugs.rows[0].n,
      };
      runs.push(run);
      log(`RTT ${rttMs} ms:`, run);
    } finally {
      await close();
    }
  }
  return runs;
}

/** Un BOOKED que tarda > 10 min en Mercado Pago y alguien abre la página del evento. */
async function bookedCleanupVsWebhook(log: (...a: unknown[]) => void) {
  const dbName = await createScenarioDatabase('purchase_booked');
  const { db, raw, close } = await openLoadDb(dbName);
  try {
    const { eventId, slug, ticketTypeIds } = await insertEvent(raw, {
      name: 'Booked race',
      ticketTypes: [{ name: 'General', price: 15000, maxAvailable: 5000 }],
    });
    const caller = callerFor(db);
    const { groupId } = await purchase(caller, eventId, ticketTypeIds[0], 3);
    // El comprador está pagando en Mercado Pago (status sigue BOOKED) hace 11 minutos.
    await raw.query(
      `UPDATE "ticketGroup" SET "createdAt" = now() - interval '11 minutes' WHERE id = $1`,
      [groupId],
    );
    await caller.events.getPublicBySlug(slug); // cualquier visitante
    const left = await raw.query(
      `SELECT (SELECT count(*)::int FROM "ticketGroup" WHERE id = $1) AS groups,
              (SELECT count(*)::int FROM "emittedTicket" WHERE "ticketGroupId" = $1) AS tickets`,
      [groupId],
    );
    let webhook = 'ok';
    try {
      // Lo primero que hace /api/mercadopago cuando el pago se aprueba.
      await updateTicketGroupStatus(db, groupId, 'PAID');
    } catch (error) {
      webhook = errorMessage(error);
    }
    const out = {
      minutesInMercadoPago: 11,
      groupAfterPageVisit: left.rows[0].groups,
      ticketsAfterPageVisit: left.rows[0].tickets,
      webhookResult: webhook,
    };
    log('BOOKED vs webhook:', out);
    return out;
  } finally {
    await close();
  }
}

export default async function run(log: (...a: unknown[]) => void) {
  return {
    bookedCleanupVsWebhook: await bookedCleanupVsWebhook(log),
    throughput: await checkoutThroughput(log),
  };
}
