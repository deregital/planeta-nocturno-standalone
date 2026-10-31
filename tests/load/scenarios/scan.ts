/**
 * Control de acceso de un evento de 5000 personas con emittedTickets.scan
 * (el mismo mutation que usan /admin/event/[slug]/scan y /admin/ticketing/scan).
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
  insertSoldTickets,
  insertUser,
} from '@tests/load/lib/seed';
import { countBy, errorMessage, summarize, timed } from '@tests/load/lib/stats';
import { encryptString } from '@/server/utils/utils';

async function seedDoorEvent(
  raw: Parameters<typeof insertSoldTickets>[0],
  name: string,
) {
  const { eventId, ticketTypeIds } = await insertEvent(raw, {
    name,
    ticketTypes: [
      { name: 'General', price: 15000, maxAvailable: 4000 },
      { name: 'VIP', price: 30000, maxAvailable: 1000 },
    ],
  });
  await insertSoldTickets(raw, { eventId, ticketTypeIds, groups: 2000 });
  await raw.query('ANALYZE');
  const { rows } = await raw.query(
    `SELECT id FROM "emittedTicket" WHERE "eventId" = $1 ORDER BY random()`,
    [eventId],
  );
  return { eventId, ticketIds: rows.map((r) => r.id as string) };
}

/** 5000 personas, 12 dispositivos escaneando sin pausa. */
async function doorThroughput(log: (...a: unknown[]) => void) {
  const runs: unknown[] = [];
  for (const rttMs of [0, 20, 60]) {
    const dbName = await createScenarioDatabase(`scan_door_${rttMs}`);
    const { db, raw, close } = await openLoadDb(dbName, { rttMs, poolMax: 20 });
    try {
      const devices = 12;
      const scannerIds: string[] = [];
      for (let i = 0; i < devices; i++) {
        scannerIds.push(await insertUser(raw, 'CONTROL_TICKETING'));
      }
      const { eventId, ticketIds } = await seedDoorEvent(
        raw,
        `Puerta ${rttMs}`,
      );
      const callers = scannerIds.map((id) =>
        callerFor(db, { id, role: 'CONTROL_TICKETING' }),
      );
      // 3% de los intentos repiten un QR ya escaneado minutos antes (no en
      // simultáneo) y 1% son QRs de otro evento/basura.
      const attempts = ticketIds.map((id, i) =>
        i % 100 === 0
          ? 'qr-invalido'
          : i % 33 === 0 && i >= 500
            ? encryptString(ticketIds[i - 500])
            : encryptString(id),
      );

      resetQueryCount();
      const statuses: string[] = [];
      const latencies: number[] = [];
      let next = 0;
      const wall = await timed(() =>
        Promise.all(
          callers.map(async (caller) => {
            while (next < attempts.length) {
              const barcode = attempts[next++];
              try {
                const r = await timed(() =>
                  caller.emittedTickets.scan({ barcode, eventIds: [eventId] }),
                );
                latencies.push(r.ms);
                statuses.push(r.value.status);
              } catch (error) {
                statuses.push(`error: ${errorMessage(error)}`);
              }
            }
          }),
        ),
      );
      const run = {
        rttMs,
        devices,
        attempts: attempts.length,
        wallSeconds: Math.round(wall.ms / 100) / 10,
        scansPerSecond:
          Math.round((attempts.length / wall.ms) * 1000 * 10) / 10,
        latency: summarize(latencies),
        statuses: countBy(statuses, (s) => s),
        queriesPerScan:
          Math.round((getQueryCount() / attempts.length) * 10) / 10,
      };
      runs.push(run);
      log(`puerta RTT ${rttMs} ms:`, run);
    } finally {
      await close();
    }
  }
  return runs;
}

export default async function run(log: (...a: unknown[]) => void) {
  return {
    doorThroughput: await doorThroughput(log),
  };
}
