/**
 * Páginas del evento a medida que se llena:
 *  - events.getPublicBySlug + ticketGroup.getTicketTypeAmounts: página de compra,
 *    escáner y cada canje de invitación.
 *  - events.getBySlug: /admin/event/[slug] y /organization/event/[slug].
 */
import { callerFor } from '@tests/load/lib/caller';
import {
  createScenarioDatabase,
  getQueryCount,
  openLoadDb,
  resetQueryCount,
} from '@tests/load/lib/db';
import {
  insertEvent,
  insertHistory,
  insertSoldTickets,
  insertUser,
} from '@tests/load/lib/seed';
import {
  countBy,
  errorMessage,
  payloadBytes,
  runPool,
  summarize,
  timed,
} from '@tests/load/lib/stats';

const STEPS = [500, 1000, 2000, 4000]; // grupos → 1250, 2500, 5000, 10000 entradas
const REPEAT = 5;

async function sample(fn: () => Promise<unknown>) {
  const times: number[] = [];
  let value: unknown;
  let queries = 0;
  for (let i = 0; i < REPEAT; i++) {
    resetQueryCount();
    const r = await timed(fn);
    queries = getQueryCount();
    times.push(r.ms);
    value = r.value;
  }
  return { ...summarize(times), queries, bytes: payloadBytes(value) };
}

/** `count` llamadas a la vez contra un pool de 10 conexiones. */
async function concurrent(count: number, fn: () => Promise<unknown>) {
  const wall = await timed(() =>
    runPool(count, count, async () => (await timed(fn)).ms),
  );
  const ok = wall.value
    .filter(
      (r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled',
    )
    .map((r) => r.value);
  return {
    calls: count,
    poolMax: 10,
    wallMs: Math.round(wall.ms),
    latency: summarize(ok),
    failed: wall.value.length - ok.length,
    failures: countBy(
      wall.value.filter((r) => r.status === 'rejected'),
      (r) => errorMessage((r as PromiseRejectedResult).reason).slice(-200),
    ),
  };
}

export default async function run(log: (...a: unknown[]) => void) {
  const dbName = await createScenarioDatabase('public_page');
  const { db, raw, close } = await openLoadDb(dbName, { poolMax: 10 });
  const results: Record<string, unknown> = {};

  try {
    const seed = await timed(() =>
      insertHistory(raw, { events: 20, groupsPerEvent: 2000, dniPool: 60_000 }),
    );
    log(`historial: 20 eventos × 5000 entradas en ${Math.round(seed.ms)} ms`);

    const adminId = await insertUser(raw, 'ADMIN');
    const { eventId, slug, ticketTypeIds } = await insertEvent(raw, {
      name: 'Fiesta 5000',
      ticketTypes: [
        { name: 'General', price: 15000, maxAvailable: 4000 },
        { name: 'VIP', price: 30000, maxAvailable: 900 },
        { name: 'Mesa', price: 120000, maxAvailable: 100, category: 'TABLE' },
      ],
    });

    const visitor = callerFor(db);
    const admin = callerFor(db, { id: adminId, role: 'ADMIN' });
    const steps: unknown[] = [];
    let groupsSoFar = 0;
    for (const target of STEPS) {
      await insertSoldTickets(raw, {
        eventId,
        ticketTypeIds,
        groups: target - groupsSoFar,
      });
      groupsSoFar = target;
      await raw.query('ANALYZE');

      const publicPage = await sample(() =>
        visitor.events.getPublicBySlug(slug),
      );
      const stock = await sample(() =>
        visitor.ticketGroup.getTicketTypeAmounts(eventId),
      );
      const adminPage = await sample(() => admin.events.getBySlug(slug));
      const step = {
        groups: target,
        tickets: target * 2.5,
        getPublicBySlug: publicPage,
        getTicketTypeAmounts: stock,
        getBySlug: adminPage,
      };
      steps.push(step);
      log(
        `${target * 2.5} entradas → getPublicBySlug p50 ${publicPage.p50} ms (${publicPage.bytes} B) | getTicketTypeAmounts p50 ${stock.p50} ms | getBySlug (admin) p50 ${adminPage.p50} ms, ${(adminPage.bytes / 1e6).toFixed(2)} MB`,
      );

      if (target === 2000) {
        // Lanzamiento: 200 visitantes abren la página de compra a la vez.
        results.launchVisitors = await concurrent(200, () =>
          Promise.all([
            visitor.events.getPublicBySlug(slug),
            visitor.ticketGroup.getTicketTypeAmounts(eventId),
          ]),
        );
        log('200 visitantes a la vez:', results.launchVisitors);
        // 10 personas del staff con la página de admin abierta y recargando.
        results.staffAdminPage = await concurrent(10, () =>
          admin.events.getBySlug(slug),
        );
        log('10 staff en la página de admin:', results.staffAdminPage);
      }
    }
    results.steps = steps;
  } finally {
    await close();
  }

  return results;
}
