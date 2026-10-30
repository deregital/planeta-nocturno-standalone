import { eq, max, sql } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { ticketXorganizer } from '@/drizzle/schema';

type InvitationCodeTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Filas por INSERT. 4 parámetros por fila: queda lejos del límite de 65535, y una tanda chica se puede reintentar si un código choca. */
const INVITATION_CODE_CHUNK = 500;
const INVITATION_CODE_ATTEMPTS = 5;
const SINGLE_CODE_ATTEMPTS = 40;
/** `code_key` es el índice global, hasta que corre la migración. Después el choque lo tira la PK `(eventId, code)`. */
const INVITATION_CODE_COLLISIONS = [
  'ticketXOrganizer_pkey',
  'ticketXOrganizer_code_key',
];

export type InvitationCodeInsert = {
  eventId: string;
  organizerId: string;
  ticketGroupId: string;
  shortId: number;
};

function isInvitationCodeCollision(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== 'object') return false;
    const record = current as {
      code?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    const constraint = record.constraint;
    const message = record.message;
    const namesConstraint =
      typeof constraint === 'string' &&
      INVITATION_CODE_COLLISIONS.includes(constraint);
    const namesMessage =
      typeof message === 'string' &&
      INVITATION_CODE_COLLISIONS.some((name) => message.includes(name));
    if (namesConstraint || namesMessage) return true;
    if (record.code === '23505' && record.constraint && !namesConstraint) {
      return false;
    }
    if (!record.cause) return false;
    current = record.cause;
  }
  return false;
}

async function insertInvitationCodeChunk(
  tx: InvitationCodeTx,
  rows: InvitationCodeInsert[],
) {
  if (rows.length === 0) return;

  const attempts =
    rows.length === 1 ? SINGLE_CODE_ATTEMPTS : INVITATION_CODE_ATTEMPTS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await tx.transaction(async (savepoint) => {
        await savepoint.insert(ticketXorganizer).values(rows);
      });
      return;
    } catch (error) {
      if (!isInvitationCodeCollision(error)) throw error;
      lastError = error;
    }
  }

  if (rows.length === 1) throw lastError;

  const middle = Math.ceil(rows.length / 2);
  await insertInvitationCodeChunk(tx, rows.slice(0, middle));
  await insertInvitationCodeChunk(tx, rows.slice(middle));
}

/**
 * Inserta códigos de invitación. El default de la columna genera el código.
 * Si uno se repite, se revierte solo esa tanda (savepoint) y se vuelve a generar.
 * No aborta la creación del evento.
 */
export async function insertInvitationCodes(
  tx: InvitationCodeTx,
  rows: InvitationCodeInsert[],
) {
  for (let offset = 0; offset < rows.length; offset += INVITATION_CODE_CHUNK) {
    await insertInvitationCodeChunk(
      tx,
      rows.slice(offset, offset + INVITATION_CODE_CHUNK),
    );
  }
}

/** Namespace for pg_advisory_xact_lock(key1, key2) — avoids clashes with other advisory locks. */
const TICKET_X_ORGANIZER_SHORT_ID_LOCK_NS = 742_191;

/**
 * Reserves consecutive shortIds for an event. Must run on a transaction handle (`tx`)
 * so the advisory lock is held until commit and matches the subsequent inserts.
 */
export async function allocateTicketXOrganizerShortIds(
  executor: Pick<Db, 'select' | 'execute'>,
  eventId: string,
  count: number,
): Promise<number[]> {
  if (count <= 0) {
    return [];
  }

  await executor.execute(
    sql`SELECT pg_advisory_xact_lock(${TICKET_X_ORGANIZER_SHORT_ID_LOCK_NS}, hashtext(${eventId}))`,
  );

  const [row] = await executor
    .select({ m: max(ticketXorganizer.shortId) })
    .from(ticketXorganizer)
    .where(eq(ticketXorganizer.eventId, eventId));
  const start = Number(row?.m ?? 0);
  return Array.from({ length: count }, (_, i) => start + i + 1);
}
