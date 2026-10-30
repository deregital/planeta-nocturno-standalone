/**
 * Crea un evento INVITATION de 30.000 por events.create (códigos al azar,
 * reintento si se repiten) y redistribuye esos códigos con el jefe.
 * Sin mails, PDFs ni S3.
 */
import type { Pool } from 'pg';
import type { OrganizerInvitationSchema } from '@/server/schemas/organizer';

import type { Db } from '@/drizzle';

import { applyChiefOrganizerInvitationDistribution } from '@/server/utils/chief-organizer-invitation-distribution';
import { callerFor } from '@tests/load/lib/caller';
import {
  createScenarioDatabase,
  getQueryCount,
  openLoadDb,
  resetQueryCount,
} from '@tests/load/lib/db';
import { invitationInvariants } from '@tests/load/lib/invitation';
import { insertUser } from '@tests/load/lib/seed';
import { errorMessage, timed } from '@tests/load/lib/stats';

const TOTAL = 30_000;
const ORGANIZERS = 20;
const PER_ORGANIZER = TOTAL / ORGANIZERS;

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

async function loadOrganizers(raw: Pool, ids: string[]) {
  const { rows } = await raw.query(
    `SELECT id, dni, "fullName", "phoneNumber", role FROM "user" WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id as string, row]));
  return ids.map((id) => byId.get(id) as OrganizerRow);
}

function eventInput(
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

async function codeStats(raw: Pool, eventId: string) {
  const { rows } = await raw.query(
    `SELECT count(*)::int AS codes,
            count(DISTINCT code)::int AS distinct_codes
     FROM "ticketXOrganizer"
     WHERE "eventId" = $1`,
    [eventId],
  );
  return rows[0] as { codes: number; distinct_codes: number };
}

type Team = { chiefId: string; subordinateIds: string[] };

async function teamInput(
  raw: Pool,
  team: Team,
  amounts: Map<string, number>,
): Promise<OrganizerInvitationSchema[]> {
  const organizers = await loadOrganizers(raw, [
    team.chiefId,
    ...team.subordinateIds,
  ]);
  return organizers.map((organizer) => ({
    id: organizer.id,
    dni: organizer.dni,
    fullName: organizer.fullName,
    phoneNumber: organizer.phoneNumber,
    role: organizer.role,
    type: 'INVITATION' as const,
    ticketAmount: amounts.get(organizer.id) ?? 0,
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

export default async function run(log: (...args: unknown[]) => void) {
  const dbName = await createScenarioDatabase('invitation_create_redistribute');
  const { db, raw, close } = await openLoadDb(dbName, { poolMax: 10 });
  try {
    const adminId = await insertUser(raw, 'ADMIN');
    const admin = callerFor(db, { id: adminId, role: 'ADMIN' });

    const singleId = await insertUser(raw, 'ORGANIZER');
    const single = await loadOrganizers(raw, [singleId]);
    log('creación real: 1 organizador con 30000 códigos');
    let createOne: unknown;
    try {
      const created = await timed(() =>
        admin.events.create(
          eventInput(
            'Invitation 30000 un organizador',
            single,
            new Map([[singleId, TOTAL]]),
          ),
        ),
      );
      createOne = {
        ok: true,
        ms: Math.round(created.ms),
        eventId: created.value.eventCreated.id,
        ...(await codeStats(raw, created.value.eventCreated.id)),
      };
    } catch (error) {
      createOne = { ok: false, error: brief(error) };
    }
    log(createOne);

    const chiefId = await insertUser(raw, 'CHIEF_ORGANIZER');
    const subordinateIds: string[] = [];
    for (let i = 0; i < ORGANIZERS; i++) {
      subordinateIds.push(
        await insertUser(raw, 'ORGANIZER', { chiefOrganizerId: chiefId }),
      );
    }
    const team: Team = { chiefId, subordinateIds };
    const createdAmounts = amountsFor(team, PER_ORGANIZER, 0);
    const teamUsers = await loadOrganizers(raw, [chiefId, ...subordinateIds]);
    log('creación real: jefe + 20 organizadores de 1500');
    let createdEventId: string | null = null;
    let createTeam: unknown;
    try {
      const created = await timed(() =>
        admin.events.create(
          eventInput('Invitation 30000 equipo', teamUsers, createdAmounts),
        ),
      );
      createdEventId = created.value.eventCreated.id;
      createTeam = {
        ok: true,
        ms: Math.round(created.ms),
        eventId: createdEventId,
        ...(await codeStats(raw, createdEventId)),
        invariants: await invitationInvariants(raw, createdEventId),
      };
    } catch (error) {
      createTeam = { ok: false, error: brief(error) };
    }
    log(createTeam);

    let toChief: unknown = { skipped: true };
    let back: unknown = { skipped: true };
    if (createdEventId) {
      log('mover los 30000 códigos creados al jefe');
      try {
        toChief = await measureMove(
          db,
          raw,
          createdEventId,
          team,
          amountsFor(team, 0, 0),
        );
      } catch (error) {
        toChief = { error: brief(error) };
      }
      log('al jefe:', JSON.stringify(toChief));

      if (toChief && typeof toChief === 'object' && !('error' in toChief)) {
        log('devolver los 30000 códigos a los organizadores');
        try {
          back = await measureMove(
            db,
            raw,
            createdEventId,
            team,
            amountsFor(team, PER_ORGANIZER, 0),
          );
        } catch (error) {
          back = { error: brief(error) };
        }
        log('de vuelta:', JSON.stringify(back));
      }
    }

    return {
      database: dbName,
      notes: { tenant: 'single', rttMs: 0, emails: 0, s3: 0, pdfs: 0 },
      createOneOrganizer: createOne,
      createTeam,
      moveAllToChief: toChief,
      moveAllBack: back,
    };
  } finally {
    await close();
  }
}
