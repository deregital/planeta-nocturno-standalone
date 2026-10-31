/**
 * Redistribución de invitaciones del jefe de organizadores
 * (events.updateChiefOrganizerTicketDistribution → applyChiefOrganizerInvitationDistribution)
 * en un evento de 5000 cupos con 20 organizadores y 40% ya canjeado.
 */
import type { Pool } from 'pg';
import type { OrganizerInvitationSchema } from '@/server/schemas/organizer';

import type { Db } from '@/drizzle';

import { applyChiefOrganizerInvitationDistribution } from '@/server/utils/chief-organizer-invitation-distribution';
import {
  createScenarioDatabase,
  getQueryCount,
  openLoadDb,
  resetQueryCount,
} from '@tests/load/lib/db';
import { invitationInvariants } from '@tests/load/lib/invitation';
import { insertInvitationEvent, insertUser } from '@tests/load/lib/seed';
import { errorMessage, timed } from '@tests/load/lib/stats';

const SUBORDINATES = 20;
const PER_ORGANIZER = 250;

type Team = { chiefId: string; subordinateIds: string[] };

async function seedTeamEvent(raw: Pool, name: string) {
  const chiefId = await insertUser(raw, 'CHIEF_ORGANIZER');
  const subordinateIds: string[] = [];
  for (let i = 0; i < SUBORDINATES; i++) {
    subordinateIds.push(
      await insertUser(raw, 'ORGANIZER', { chiefOrganizerId: chiefId }),
    );
  }
  const event = await insertInvitationEvent(raw, {
    name,
    organizers: [
      { id: chiefId, ticketAmount: 0 },
      ...subordinateIds.map((id) => ({ id, ticketAmount: PER_ORGANIZER })),
    ],
    usedRatio: 0.4,
  });
  await raw.query('ANALYZE');
  return { ...event, team: { chiefId, subordinateIds } };
}

async function teamInput(
  raw: Pool,
  team: Team,
  amounts: Map<string, number>,
): Promise<OrganizerInvitationSchema[]> {
  const ids = [team.chiefId, ...team.subordinateIds];
  const { rows } = await raw.query(
    `SELECT id, dni, "fullName", "phoneNumber", role FROM "user" WHERE id = ANY($1)`,
    [ids],
  );
  return ids.map((id) => {
    const u = rows.find((r) => r.id === id)!;
    return {
      id,
      dni: u.dni,
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      role: u.role,
      type: 'INVITATION' as const,
      ticketAmount: amounts.get(id) ?? PER_ORGANIZER,
    };
  });
}

/** Quita `delta` a los organizadores [from, to) → vuelven al jefe. */
function takeFrom(team: Team, from: number, to: number, delta: number) {
  const amounts = new Map<string, number>();
  team.subordinateIds.forEach((id, i) =>
    amounts.set(
      id,
      i >= from && i < to ? PER_ORGANIZER - delta : PER_ORGANIZER,
    ),
  );
  amounts.set(team.chiefId, (to - from) * delta);
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
  return { ms: Math.round(result.ms), queries: getQueryCount() };
}

async function latencySweep(log: (...a: unknown[]) => void) {
  const runs: unknown[] = [];
  for (const rttMs of [0, 4, 20, 60]) {
    const dbName = await createScenarioDatabase(`redistribution_${rttMs}`);
    const { db, raw, close } = await openLoadDb(dbName, { rttMs });
    try {
      const { eventId, team } = await seedTeamEvent(
        raw,
        `Redistribucion ${rttMs}`,
      );

      // 1) Quitar 100 a 10 organizadores (1000 códigos vuelven al jefe).
      const back = await measureMove(
        db,
        raw,
        eventId,
        team,
        takeFrom(team, 0, 10, 100),
      );
      // 2) Repartir esos 1000 entre los otros 10 (+100 c/u).
      const give = new Map<string, number>();
      team.subordinateIds.forEach((id, i) =>
        give.set(id, i < 10 ? PER_ORGANIZER - 100 : PER_ORGANIZER + 100),
      );
      give.set(team.chiefId, 0);
      const out = await measureMove(db, raw, eventId, team, give);
      // 3) Un ajuste chico: 1 organizador −10.
      const small = new Map(give);
      small.set(team.subordinateIds[0], PER_ORGANIZER - 110);
      small.set(team.chiefId, 10);
      const tiny = await measureMove(db, raw, eventId, team, small);

      const run = {
        rttMs,
        move1000ToChief: back,
        move1000FromChief: out,
        move10ToChief: tiny,
        invariants: await invitationInvariants(raw, eventId),
      };
      runs.push(run);
      log(`RTT ${rttMs} ms:`, JSON.stringify(run));
    } finally {
      await close();
    }
  }
  return runs;
}

/** El jefe guarda desde dos pestañas (o doble click) con distribuciones distintas. */
async function concurrentRedistributions(log: (...a: unknown[]) => void) {
  const dbName = await createScenarioDatabase('redistribution_double');
  const { db, raw, close } = await openLoadDb(dbName, {
    rttMs: 4,
    poolMax: 10,
  });
  try {
    const { eventId, team } = await seedTeamEvent(raw, 'Redistribucion doble');
    const inputA = await teamInput(raw, team, takeFrom(team, 0, 10, 100));
    const inputB = await teamInput(raw, team, takeFrom(team, 10, 20, 50));
    const results = await Promise.allSettled([
      applyChiefOrganizerInvitationDistribution(db, {
        chiefOrganizerId: team.chiefId,
        eventId,
        organizersInput: inputA,
      }),
      applyChiefOrganizerInvitationDistribution(db, {
        chiefOrganizerId: team.chiefId,
        eventId,
        organizersInput: inputB,
      }),
    ]);
    const chief = await raw.query(
      `SELECT x."ticketAmount" AS assigned,
              (SELECT count(*)::int FROM "ticketXOrganizer" t
               WHERE t."eventId" = $1 AND t."organizerId" = $2) AS codes
       FROM "eventXOrganizer" x WHERE x."eventId" = $1 AND x."organizerId" = $2`,
      [eventId, team.chiefId],
    );
    const out = {
      tabA: 'quita 100 a organizadores 1-10',
      tabB: 'quita 50 a organizadores 11-20 (con datos viejos)',
      outcomes: results.map((r) =>
        r.status === 'fulfilled' ? 'ok' : `error: ${errorMessage(r.reason)}`,
      ),
      chief: chief.rows[0],
      invariants: await invitationInvariants(raw, eventId),
    };
    log('dos redistribuciones simultáneas:', JSON.stringify(out));
    return out;
  } finally {
    await close();
  }
}

export default async function run(log: (...a: unknown[]) => void) {
  return {
    latencySweep: await latencySweep(log),
    concurrentRedistributions: await concurrentRedistributions(log),
  };
}
