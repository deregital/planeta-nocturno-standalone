import type { Pool } from 'pg';

import { randomUUID } from 'node:crypto';

import { SYSTEM_ACCESS_ROLE_IDS } from '@/lib/rbac/permissions';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

type Role =
  | 'ADMIN'
  | 'CHIEF_ORGANIZER'
  | 'ORGANIZER'
  | 'TICKETING'
  | 'CONTROL_TICKETING';

let userSeq = 0;

export async function insertUser(
  raw: Pool,
  role: Role,
  { chiefOrganizerId }: { chiefOrganizerId?: string } = {},
) {
  userSeq += 1;
  const id = randomUUID();
  const tag = `${role.toLowerCase()}-${userSeq}-${id.slice(0, 6)}`;
  await raw.query(
    `INSERT INTO "user" (id, name, "fullName", password, email, "birthDate", dni,
       "phoneNumber", gender, role, "chiefOrganizerId", "accessRoleId")
     VALUES ($1, $2, $3, 'x', $4, '1990-01-01', $5, '+5491155550000', 'other', $6, $7, $8)`,
    [
      id,
      tag,
      `Usuario ${tag}`,
      `${tag}@load.test`,
      `9${String(userSeq).padStart(7, '0')}${id.slice(0, 4)}`,
      role,
      chiefOrganizerId ?? null,
      SYSTEM_ACCESS_ROLE_IDS[role],
    ],
  );
  return id;
}

export type TicketTypeSeed = {
  name: string;
  price: number;
  maxAvailable: number;
  maxPerPurchase?: number;
  category?: 'FREE' | 'PAID' | 'TABLE';
  visibleInWeb?: boolean;
};

export async function insertEvent(
  raw: Pool,
  {
    name,
    inviteCondition = 'TRADITIONAL',
    ticketTypes,
    startingDate = new Date(Date.now() + 7 * 86_400_000),
    isActive = true,
  }: {
    name: string;
    inviteCondition?: 'TRADITIONAL' | 'INVITATION' | 'SIMPLE';
    ticketTypes: TicketTypeSeed[];
    startingDate?: Date;
    isActive?: boolean;
  },
) {
  const eventId = randomUUID();
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${eventId.slice(0, 6)}`;
  await raw.query(
    `INSERT INTO event (id, name, description, "coverImageUrl", slug, "startingDate",
       "endingDate", "isActive", "inviteCondition")
     VALUES ($1, $2, 'Evento de prueba de carga', 'https://example.com/cover.jpg', $3, $4, $5, $6, $7)`,
    [
      eventId,
      name,
      slug,
      startingDate.toISOString(),
      new Date(startingDate.getTime() + 8 * 3_600_000).toISOString(),
      isActive,
      inviteCondition,
    ],
  );

  const ticketTypeIds: string[] = [];
  for (const [index, type] of ticketTypes.entries()) {
    const id = randomUUID();
    ticketTypeIds.push(id);
    await raw.query(
      `INSERT INTO "ticketType" (id, name, description, price, "maxAvailable", "maxPerPurchase",
         category, "visibleInWeb", "eventId", slug, "sortOrder", "startingDate")
       VALUES ($1, $2, 'Tipo de prueba', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        type.name,
        type.price,
        type.maxAvailable,
        type.maxPerPurchase ?? 6,
        type.category ?? (type.price > 0 ? 'PAID' : 'FREE'),
        type.visibleInWeb ?? true,
        eventId,
        `T${index}${eventId.slice(0, 4)}`.toUpperCase(),
        index + 1,
        startingDate.toISOString(),
      ],
    );
  }

  return { eventId, slug, ticketTypeIds };
}

/**
 * Inserta `groups` compras de 1 a 4 entradas (promedio 2,5) con datos personales,
 * respuestas a una pregunta y, opcionalmente, una parte ya escaneada.
 * Con groups = 2000 quedan exactamente 5000 entradas.
 */
export async function insertSoldTickets(
  raw: Pool,
  {
    eventId,
    ticketTypeIds,
    groups,
    status = 'PAID',
    dniPool = 60_000,
    scannedRatio = 0,
    invitedByIds = [],
    withAnswers = true,
    soldUntil = new Date(),
  }: {
    eventId: string;
    ticketTypeIds: string[];
    groups: number;
    status?: 'PAID' | 'FREE' | 'BOOKED';
    dniPool?: number;
    scannedRatio?: number;
    invitedByIds?: string[];
    withAnswers?: boolean;
    /** Las compras se reparten en los 20 días previos a esta fecha. */
    soldUntil?: Date;
  },
) {
  const client = await raw.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `CREATE TEMP TABLE tmp_groups ON COMMIT DROP AS
       SELECT n,
              gen_random_uuid() AS id,
              (n % 4) + 1 AS amount,
              ($2::uuid[])[1 + (n % array_length($2::uuid[], 1))] AS type_id,
              CASE WHEN cardinality($3::uuid[]) > 0
                   THEN ($3::uuid[])[1 + (n % cardinality($3::uuid[]))] END AS invited_by
       FROM generate_series(0, $1 - 1) n`,
      [groups, ticketTypeIds, invitedByIds],
    );
    await client.query(
      `INSERT INTO "ticketGroup" (id, status, "amountTickets", event_id, "invitedById", "createdAt", "totalAmount")
       SELECT id, $2::"TicketGroupStatus", amount, $1, invited_by,
              $3::timestamptz - (random() * interval '20 days'), amount * 10000
       FROM tmp_groups`,
      [eventId, status, soldUntil.toISOString()],
    );
    await client.query(
      `INSERT INTO "ticketTypePerGroup" (amount, "ticketTypeId", "ticketGroupId")
       SELECT amount, type_id, id FROM tmp_groups`,
    );
    const { rows } = await client.query(
      `SELECT coalesce(max("shortId"), 0) AS m FROM "emittedTicket" WHERE "eventId" = $1`,
      [eventId],
    );
    await client.query(
      `INSERT INTO "emittedTicket" ("fullName", dni, mail, gender, "phoneNumber", instagram,
         "birthDate", slug, "ticketTypeId", "ticketGroupId", "eventId", "shortId",
         scanned, "scannedAt", "createdAt")
       SELECT 'Persona ' || d.dni, d.dni, 'persona' || d.dni || '@mail.test', 'female',
              '+54911' || (50000000 + (d.dni::int % 9999999))::text, '@persona' || d.dni,
              '1998-03-15', 'entrada-' || (row_number() OVER ()), g.type_id, g.id, $1,
              $2 + row_number() OVER (),
              s.scanned, CASE WHEN s.scanned THEN $5::timestamptz END,
              $5::timestamptz - (random() * interval '20 days')
       FROM tmp_groups g
       CROSS JOIN LATERAL generate_series(1, g.amount) k
       CROSS JOIN LATERAL (SELECT (30000000 + floor(random() * $3))::int::text AS dni, g.n + k * 0 AS seed) d
       CROSS JOIN LATERAL (SELECT random() < $4 AS scanned, d.seed AS s2) s`,
      [
        eventId,
        Number(rows[0].m),
        dniPool,
        scannedRatio,
        soldUntil.toISOString(),
      ],
    );
    if (withAnswers) {
      const questionId = randomUUID();
      await client.query(
        `INSERT INTO "eventQuestion" (id, text, "eventId") VALUES ($1, '¿Cómo te enteraste?', $2)`,
        [questionId, eventId],
      );
      await client.query(
        `INSERT INTO "ticketGroupAnswer" (answer, "questionId", "ticketGroupId")
         SELECT 'Instagram', $1, id FROM tmp_groups`,
        [questionId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Historial del tenant: eventos pasados con sus compradores (DNIs repetidos entre eventos). */
export async function insertHistory(
  raw: Pool,
  {
    events,
    groupsPerEvent,
    dniPool,
  }: { events: number; groupsPerEvent: number; dniPool: number },
) {
  for (let i = 0; i < events; i++) {
    const startingDate = new Date(Date.now() - (i + 1) * 14 * 86_400_000);
    const { eventId, ticketTypeIds } = await insertEvent(raw, {
      name: `Historial ${i + 1}`,
      startingDate,
      isActive: false,
      ticketTypes: [
        { name: 'General', price: 15000, maxAvailable: 4000 },
        { name: 'VIP', price: 30000, maxAvailable: 1000 },
      ],
    });
    await insertSoldTickets(raw, {
      eventId,
      ticketTypeIds,
      groups: groupsPerEvent,
      dniPool,
      scannedRatio: 0.85,
      soldUntil: startingDate,
    });
  }
}

/** Códigos únicos garantizados para seeds (los reales usan md5(random()) de 6 hex). */
let codeSeq = 0x100000;
function nextSeedCode() {
  codeSeq += 1;
  return codeSeq.toString(16).toUpperCase();
}

export type InvitationOrganizerSeed = { id: string; ticketAmount: number };

/**
 * Evento en modo INVITACIÓN tal como lo deja events.create: tipo de entrada único,
 * tipo "Organizador", un grupo por organizador y un código por cupo.
 */
export async function insertInvitationEvent(
  raw: Pool,
  {
    name,
    organizers,
    usedRatio = 0,
  }: {
    name: string;
    organizers: InvitationOrganizerSeed[];
    usedRatio?: number;
  },
) {
  const total = organizers.reduce((sum, o) => sum + o.ticketAmount, 0);
  const { eventId, slug, ticketTypeIds } = await insertEvent(raw, {
    name,
    inviteCondition: 'INVITATION',
    ticketTypes: [
      { name: 'Invitación', price: 0, maxAvailable: total, maxPerPurchase: 1 },
      {
        name: ORGANIZER_TICKET_TYPE_NAME,
        price: 0,
        maxAvailable: organizers.length,
        maxPerPurchase: 1,
        visibleInWeb: false,
      },
    ],
  });
  const [invitationTypeId, organizerTypeId] = ticketTypeIds;

  const client = await raw.connect();
  try {
    await client.query('BEGIN');
    const organizerGroupId = randomUUID();
    await client.query(
      `INSERT INTO "ticketGroup" (id, status, "amountTickets", event_id, "isOrganizerGroup")
       VALUES ($1, 'FREE', $2, $3, true)`,
      [organizerGroupId, organizers.length, eventId],
    );

    let shortId = 0;
    let txoShortId = 0;
    // Las entradas de invitados usan shortIds por encima de las de organizadores.
    let guestShortId = 1_000_000;
    for (const organizer of organizers) {
      await client.query(
        `INSERT INTO "eventXOrganizer" ("eventId", "organizerId", "ticketAmount") VALUES ($1, $2, $3)`,
        [eventId, organizer.id, organizer.ticketAmount],
      );
      shortId += 1;
      await client.query(
        `INSERT INTO "emittedTicket" ("fullName", dni, mail, gender, "phoneNumber", "birthDate",
           slug, "ticketTypeId", "ticketGroupId", "eventId", "shortId")
         SELECT "fullName", dni, email, gender, "phoneNumber", "birthDate", $6,
                $1, $2, $3, $4 FROM "user" WHERE id = $5`,
        [
          organizerTypeId,
          organizerGroupId,
          eventId,
          shortId,
          organizer.id,
          `organizador-${shortId}`,
        ],
      );
      if (organizer.ticketAmount === 0) continue;

      const groupId = randomUUID();
      await client.query(
        `INSERT INTO "ticketGroup" (id, status, "amountTickets", event_id) VALUES ($1, 'FREE', $2, $3)`,
        [groupId, organizer.ticketAmount, eventId],
      );
      const codes = Array.from(
        { length: organizer.ticketAmount },
        nextSeedCode,
      );
      await client.query(
        `INSERT INTO "ticketXOrganizer" ("organizerId", "ticketGroupId", "eventId", code, "shortId", "createdAt")
         SELECT $1, $2, $3, c, $5 + ord, now() + ord * interval '1 microsecond'
         FROM unnest($4::text[]) WITH ORDINALITY AS t(c, ord)`,
        [organizer.id, groupId, eventId, codes, txoShortId],
      );
      txoShortId += organizer.ticketAmount;

      const used = Math.floor(organizer.ticketAmount * usedRatio);
      if (used === 0) continue;
      // Canjes ya hechos: un grupo por invitado, la entrada emitida y el código consumido.
      await client.query(
        `WITH used AS (
           SELECT code, row_number() OVER (ORDER BY "createdAt") AS rn
           FROM "ticketXOrganizer"
           WHERE "eventId" = $1 AND "organizerId" = $2
           ORDER BY "createdAt" LIMIT $3
         ), groups AS (
           INSERT INTO "ticketGroup" (id, status, "amountTickets", event_id, "invitedById")
           SELECT gen_random_uuid(), 'FREE', 1, $1, $2 FROM used
           RETURNING id
         ), numbered AS (
           SELECT id, row_number() OVER () AS rn FROM groups
         ), tickets AS (
           INSERT INTO "emittedTicket" ("fullName", dni, mail, gender, "phoneNumber", "birthDate",
             slug, "ticketTypeId", "ticketGroupId", "eventId", "shortId")
           SELECT 'Invitado ' || u.code, (40000000 + $5 + u.rn)::text, lower(u.code) || '@mail.test',
                  'male', '+5491155551111', '1999-09-09', 'invitacion-' || ($5 + u.rn), $4, n.id, $1,
                  $6 + u.rn
           FROM used u JOIN numbered n ON n.rn = u.rn
           RETURNING id, "shortId"
         )
         UPDATE "ticketXOrganizer" t
         SET "ticketId" = tk.id
         FROM used u JOIN tickets tk ON tk."shortId" = $6 + u.rn
         WHERE t.code = u.code`,
        [
          eventId,
          organizer.id,
          used,
          invitationTypeId,
          guestShortId,
          guestShortId,
        ],
      );
      guestShortId += used;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { eventId, slug, invitationTypeId, organizerTypeId };
}

export function buyerInput(
  index: number,
  ticketTypeId: string,
  ticketGroupId: string,
  eventId: string,
) {
  const dni = String(20_000_000 + index);
  return {
    fullName: `Comprador ${index}`,
    dni,
    mail: `comprador${index}@mail.test`,
    gender: 'male',
    phoneNumber: '+5491155550000',
    instagram: '',
    birthDate: new Date('1997-01-01'),
    paidOnLocation: false,
    ticketTypeId,
    ticketGroupId,
    eventId,
  };
}
