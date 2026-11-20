import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

import { TZDate } from '@date-fns/tz';
import { addDays, endOfDay } from 'date-fns';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { type Db } from '@/drizzle';

import {
  emittedTicket,
  event as eventTable,
  ticketGroup,
  ticketType as ticketTypeTable,
  ticketTypePerGroup,
  user,
  withdrawalRequest,
} from '@/drizzle/schema';
import { SCAN_TIMEZONE } from '@/lib/scan/scan-texts';
import {
  formatWithdrawalNumber,
  type RefundAccount,
  WITHDRAWAL_DAYS,
  WITHDRAWAL_INELIGIBLE_REASONS,
  type WithdrawalIneligibleReason,
  WITHDRAWAL_LINK_TTL_HOURS,
  WITHDRAWAL_MIN_HOURS_BEFORE_EVENT,
} from '@/lib/withdrawal';
import { moveTicketToTrashInTx } from '@/server/services/ticketTrash';

/**
 * Botón de arrepentimiento. El comprador pide un link con el mail y el DNI de
 * la compra; el link (cifrado, vence en 24 h) le muestra sus compras y le deja
 * revocar las que están en plazo. Al confirmar, las entradas pasan a la
 * papelera con el motivo (dejan de escanearse y liberan el cupo) y queda un
 * trámite ARR-000123 con el CBU, CVU o alias que cargó el comprador. La
 * Productora le transfiere el dinero ahí y lo marca como reintegrado.
 *
 * El comprador es el titular de la primera entrada de la compra (la de menor
 * número): un invitado que figura en otra entrada del grupo no puede anular la
 * compra de otro.
 */

const TOKEN_PURPOSE = 'withdrawal-link';

/**
 * El link del mail se cambia por esta cookie (sólo en /arrepentimiento) y la
 * página queda sin el token en la URL: así no llega a la analítica ni al
 * historial.
 */
export const WITHDRAWAL_COOKIE = 'arrepentimiento';

/** Las compras de eventos que terminaron hace más de esto no se listan. */
const PAST_EVENT_VISIBLE_DAYS = 7;

export type WithdrawalAccess = { mail: string; dni: string };

export function normalizeWithdrawalMail(mail: string) {
  return mail.trim().toLowerCase();
}

/** Sin puntos, espacios ni guiones: "12.345.678" y "12345678" son el mismo DNI. */
export function normalizeWithdrawalDni(dni: string) {
  return dni.replace(/[\s.,-]/g, '').toUpperCase();
}

const normalizedDniSql = (column: typeof emittedTicket.dni) =>
  sql`upper(regexp_replace(${column}, '[[:space:].,-]', '', 'g'))`;

// ── Link firmado ─────────────────────────────────────────────────────────────

const tokenPayloadSchema = z.object({
  m: z.string(),
  d: z.string(),
  /** Plataforma: un link no sirve en otra. */
  t: z.string(),
  e: z.number(),
});

function getTokenKey() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error('Missing AUTH_SECRET environment variable');
  return createHash('sha256').update(`${TOKEN_PURPOSE}.${secret}`).digest();
}

/**
 * Cifrado (AES-256-GCM) y no sólo firmado: el link no deja ver el mail ni el
 * DNI a quien lo encuentre en un historial o un log.
 */
export function createWithdrawalToken(
  access: WithdrawalAccess,
  tenantSlug: string | null,
  now = Date.now(),
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getTokenKey(), iv);
  cipher.setAAD(Buffer.from(TOKEN_PURPOSE));
  const payload = JSON.stringify({
    m: normalizeWithdrawalMail(access.mail),
    d: normalizeWithdrawalDni(access.dni),
    t: tenantSlug ?? '',
    e: now + WITHDRAWAL_LINK_TTL_HOURS * 60 * 60 * 1000,
  } satisfies z.infer<typeof tokenPayloadSchema>);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString(
    'base64url',
  );
}

/** Null si el link es inválido, venció o es de otra plataforma. */
export function readWithdrawalToken(
  token: string,
  tenantSlug: string | null,
  now = Date.now(),
): (WithdrawalAccess & { expiresAt: number }) | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getTokenKey(),
      raw.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(TOKEN_PURPOSE));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const decrypted = Buffer.concat([
      decipher.update(raw.subarray(12, raw.length - 16)),
      decipher.final(),
    ]).toString();
    const parsed = tokenPayloadSchema.safeParse(JSON.parse(decrypted));
    if (!parsed.success) return null;
    const { m, d, t, e } = parsed.data;
    if (t !== (tenantSlug ?? '') || e <= now) return null;
    return { mail: m, dni: d, expiresAt: e };
  } catch {
    return null;
  }
}

/** Filtro de compras sin arrepentimiento, para las sumas de lo recaudado. */
export const notWithdrawn = sql`not exists (select 1 from "withdrawalRequest" w where w."ticketGroupId" = ${ticketGroup.id})`;

// ── Compras ──────────────────────────────────────────────────────────────────

type Reader = Pick<Db, 'select'>;

export type WithdrawalPurchase = {
  ticketGroupId: string;
  eventId: string;
  eventName: string;
  eventStartingDate: string | null;
  buyerName: string;
  purchasedAt: string;
  /** Último momento para arrepentirse: 10 días o 24 h antes del evento. */
  deadline: string;
  paymentMethod: 'MERCADO_PAGO' | 'TRANSFER' | 'ON_SITE' | null;
  tickets: { typeName: string; amount: number }[];
  ticketCount: number;
  amount: number;
  serviceFeeAmount: number;
  /** Null si se puede arrepentir. */
  ineligibleReason: WithdrawalIneligibleReason | null;
};

export type WithdrawalPurchaseList = {
  purchases: WithdrawalPurchase[];
  /** Arrepentimientos ya pedidos con este mail y DNI. */
  requests: {
    number: string;
    eventName: string;
    amount: number;
    status: 'PENDING_REFUND' | 'REFUNDED';
    requestedAt: string;
  }[];
};

/**
 * Fin del décimo día corrido (hora argentina) desde la entrega o el pago. Se
 * cuenta por días y no por horas: comprar a las 23 h no quita un día.
 */
export function withdrawalDeadline(purchasedAt: Date): Date {
  const local = new TZDate(purchasedAt, SCAN_TIMEZONE);
  return new Date(endOfDay(addDays(local, WITHDRAWAL_DAYS)).getTime());
}

/**
 * Lo que vence primero: los 10 días o las 24 horas antes del evento. Es la
 * fecha que ve el comprador.
 */
export function lastMomentToWithdraw(
  purchasedAt: Date,
  eventStartingDate: string | null,
): Date {
  const deadline = withdrawalDeadline(purchasedAt);
  if (!eventStartingDate) return deadline;
  const beforeEvent =
    new Date(eventStartingDate).getTime() -
    WITHDRAWAL_MIN_HOURS_BEFORE_EVENT * 60 * 60 * 1000;
  return new Date(Math.min(deadline.getTime(), beforeEvent));
}

export function getIneligibleReason(
  purchase: {
    status: 'BOOKED' | 'PAID' | 'FREE';
    paymentMethod: WithdrawalPurchase['paymentMethod'];
    amount: number;
    anyScanned: boolean;
    eventStartingDate: string | null;
    purchasedAt: string;
  },
  now: Date,
): WithdrawalIneligibleReason | null {
  if (purchase.status !== 'PAID' || purchase.amount <= 0) return 'free';
  if (purchase.paymentMethod === 'ON_SITE') return 'on_site';
  if (purchase.anyScanned) return 'used';
  if (purchase.eventStartingDate) {
    const startsAt = new Date(purchase.eventStartingDate);
    if (startsAt.getTime() <= now.getTime()) return 'event_started';
    const minNotice = WITHDRAWAL_MIN_HOURS_BEFORE_EVENT * 60 * 60 * 1000;
    if (startsAt.getTime() - now.getTime() < minNotice) return 'too_close';
  }
  const deadline = withdrawalDeadline(new Date(purchase.purchasedAt));
  if (now.getTime() > deadline.getTime()) return 'expired';
  return null;
}

/** Compras cuyo comprador (primera entrada) tiene este mail y DNI. */
async function findBuyerGroupIds(db: Reader, access: WithdrawalAccess) {
  const mail = normalizeWithdrawalMail(access.mail);
  const dni = normalizeWithdrawalDni(access.dni);
  const rows = await db
    .select({ ticketGroupId: emittedTicket.ticketGroupId })
    .from(emittedTicket)
    .where(
      and(
        sql`lower(${emittedTicket.mail}) = ${mail}`,
        or(
          eq(emittedTicket.dni, dni),
          sql`${normalizedDniSql(emittedTicket.dni)} = ${dni}`,
        ),
        // Es la primera entrada de la compra.
        sql`${emittedTicket.shortId} = (
          select min(buyer."shortId") from "emittedTicket" buyer
          where buyer."ticketGroupId" = ${emittedTicket.ticketGroupId}
        )`,
      ),
    );
  return [...new Set(rows.map((row) => row.ticketGroupId))];
}

async function loadPurchases(
  db: Reader,
  ticketGroupIds: string[],
  now: Date,
): Promise<WithdrawalPurchase[]> {
  if (ticketGroupIds.length === 0) return [];

  const visibleSince = addDays(now, -PAST_EVENT_VISIBLE_DAYS).toISOString();
  const groups = await db
    .select({
      id: ticketGroup.id,
      status: ticketGroup.status,
      paymentMethod: ticketGroup.paymentMethod,
      totalAmount: ticketGroup.totalAmount,
      purchasedAt: sql<string>`coalesce(${ticketGroup.paidAt}, ${ticketGroup.createdAt})`,
      eventId: eventTable.id,
      eventName: eventTable.name,
      eventStartingDate: eventTable.startingDate,
      serviceFee: eventTable.serviceFee,
    })
    .from(ticketGroup)
    .innerJoin(eventTable, eq(eventTable.id, ticketGroup.eventId))
    .where(
      and(
        inArray(ticketGroup.id, ticketGroupIds),
        inArray(ticketGroup.status, ['PAID', 'FREE']),
        eq(ticketGroup.isOrganizerGroup, false),
        eq(eventTable.isDeleted, false),
        sql`(${eventTable.startingDate} is null or ${eventTable.startingDate} > ${visibleSince})`,
        notWithdrawn,
      ),
    )
    .orderBy(desc(ticketGroup.createdAt));
  if (groups.length === 0) return [];

  const ids = groups.map((group) => group.id);
  const [tickets, types] = await Promise.all([
    db
      .select({
        ticketGroupId: emittedTicket.ticketGroupId,
        fullName: emittedTicket.fullName,
        shortId: emittedTicket.shortId,
        scanned: emittedTicket.scanned,
      })
      .from(emittedTicket)
      .where(inArray(emittedTicket.ticketGroupId, ids))
      .orderBy(asc(emittedTicket.shortId)),
    db
      .select({
        ticketGroupId: ticketTypePerGroup.ticketGroupId,
        amount: ticketTypePerGroup.amount,
        name: ticketTypeTable.name,
        price: ticketTypeTable.price,
      })
      .from(ticketTypePerGroup)
      .innerJoin(
        ticketTypeTable,
        eq(ticketTypeTable.id, ticketTypePerGroup.ticketTypeId),
      )
      .where(inArray(ticketTypePerGroup.ticketGroupId, ids))
      .orderBy(asc(ticketTypeTable.sortOrder)),
  ]);

  return groups.flatMap((group) => {
    const groupTickets = tickets.filter((t) => t.ticketGroupId === group.id);
    // Sin entradas no hay nada que anular (p. ej. todas en la papelera).
    if (groupTickets.length === 0) return [];
    const groupTypes = types.filter(
      (t) => t.ticketGroupId === group.id && t.amount > 0,
    );
    const amount = Number(group.totalAmount);
    // El cargo por servicio se calcula sobre el precio de lista (sin el
    // descuento del organizador), igual que al cobrar.
    const subtotal = groupTypes.reduce(
      (sum, t) => sum + t.amount * (t.price ?? 0),
      0,
    );
    const serviceFeeAmount = group.serviceFee
      ? Math.min(
          amount,
          Math.round(subtotal * (group.serviceFee / 100) * 100) / 100,
        )
      : 0;
    const purchase = {
      ticketGroupId: group.id,
      eventId: group.eventId,
      eventName: group.eventName,
      eventStartingDate: group.eventStartingDate,
      buyerName: groupTickets[0]!.fullName,
      purchasedAt: new Date(group.purchasedAt).toISOString(),
      deadline: lastMomentToWithdraw(
        new Date(group.purchasedAt),
        group.eventStartingDate,
      ).toISOString(),
      paymentMethod: group.paymentMethod,
      tickets: groupTypes.map((t) => ({ typeName: t.name, amount: t.amount })),
      ticketCount: groupTickets.length,
      amount,
      serviceFeeAmount,
    };
    return [
      {
        ...purchase,
        ineligibleReason: getIneligibleReason(
          {
            status: group.status,
            paymentMethod: group.paymentMethod,
            amount,
            anyScanned: groupTickets.some((t) => t.scanned),
            eventStartingDate: group.eventStartingDate,
            purchasedAt: group.purchasedAt,
          },
          now,
        ),
      },
    ];
  });
}

export async function listWithdrawalPurchases(
  db: Reader,
  access: WithdrawalAccess,
  now = new Date(),
): Promise<WithdrawalPurchaseList> {
  const mail = normalizeWithdrawalMail(access.mail);
  const dni = normalizeWithdrawalDni(access.dni);
  const [purchases, requests] = await Promise.all([
    findBuyerGroupIds(db, access).then((ids) => loadPurchases(db, ids, now)),
    db
      .select({
        number: withdrawalRequest.number,
        eventName: withdrawalRequest.eventName,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt,
      })
      .from(withdrawalRequest)
      .where(
        and(eq(withdrawalRequest.mail, mail), eq(withdrawalRequest.dni, dni)),
      )
      .orderBy(desc(withdrawalRequest.requestedAt)),
  ]);

  return {
    // Las que se pueden arrepentir, primero.
    purchases: purchases.sort(
      (a, b) => Number(!!a.ineligibleReason) - Number(!!b.ineligibleReason),
    ),
    requests: requests.map((request) => ({
      number: formatWithdrawalNumber(request.number),
      eventName: request.eventName,
      amount: Number(request.amount),
      status: request.status,
      requestedAt: new Date(request.requestedAt).toISOString(),
    })),
  };
}

/** Si vale la pena mandar el link: hay compras o trámites con este mail y DNI. */
export async function hasWithdrawalMatches(
  db: Reader,
  access: WithdrawalAccess,
) {
  const { purchases, requests } = await listWithdrawalPurchases(db, access);
  return purchases.length > 0 || requests.length > 0;
}

export class WithdrawalNotAllowedError extends Error {}

/**
 * Revoca la compra: vuelve a revisar el plazo con la compra bloqueada, crea el
 * trámite y pasa las entradas a la papelera, todo en la misma transacción.
 */
export async function confirmWithdrawal(
  db: Db,
  access: WithdrawalAccess,
  ticketGroupId: string,
  refundAccount: RefundAccount,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: ticketGroup.id })
      .from(ticketGroup)
      .where(eq(ticketGroup.id, ticketGroupId))
      .for('update');
    if (!locked) {
      throw new WithdrawalNotAllowedError('La compra ya no existe.');
    }

    const notYours = new WithdrawalNotAllowedError(
      'Esta compra no es del mail y DNI que ingresaste.',
    );
    const [existing] = await tx
      .select({
        number: withdrawalRequest.number,
        mail: withdrawalRequest.mail,
        dni: withdrawalRequest.dni,
      })
      .from(withdrawalRequest)
      .where(eq(withdrawalRequest.ticketGroupId, ticketGroupId))
      .limit(1);
    if (existing) {
      // Doble envío: ya no tiene entradas, así que se reconoce por el trámite.
      const isSameBuyer =
        existing.mail === normalizeWithdrawalMail(access.mail) &&
        existing.dni === normalizeWithdrawalDni(access.dni);
      if (!isSameBuyer) throw notYours;
      throw new WithdrawalNotAllowedError(
        `Ya te arrepentiste de esta compra (${formatWithdrawalNumber(existing.number)}).`,
      );
    }

    const buyerGroupIds = await findBuyerGroupIds(tx, access);
    if (!buyerGroupIds.includes(ticketGroupId)) throw notYours;

    // Las entradas quedan bloqueadas: un escaneo a la vez espera o llega tarde.
    const tickets = await tx
      .select({ id: emittedTicket.id })
      .from(emittedTicket)
      .where(eq(emittedTicket.ticketGroupId, ticketGroupId))
      .for('update');

    const [purchase] = await loadPurchases(tx, [ticketGroupId], now);
    if (!purchase) {
      throw new WithdrawalNotAllowedError('La compra ya no está disponible.');
    }
    if (purchase.ineligibleReason) {
      throw new WithdrawalNotAllowedError(
        `${WITHDRAWAL_INELIGIBLE_REASONS[purchase.ineligibleReason]}: esta compra ya no se puede arrepentir.`,
      );
    }

    const [created] = await tx
      .insert(withdrawalRequest)
      .values({
        ticketGroupId,
        eventId: purchase.eventId,
        eventName: purchase.eventName,
        ticketCount: purchase.ticketCount,
        fullName: purchase.buyerName,
        mail: normalizeWithdrawalMail(access.mail),
        dni: normalizeWithdrawalDni(access.dni),
        amount: purchase.amount.toFixed(2),
        serviceFeeAmount: purchase.serviceFeeAmount.toFixed(2),
        paymentMethod: purchase.paymentMethod,
        paidAt: purchase.purchasedAt,
        refundAccount: refundAccount.value,
      })
      .returning({
        id: withdrawalRequest.id,
        number: withdrawalRequest.number,
        requestedAt: withdrawalRequest.requestedAt,
      });

    const number = formatWithdrawalNumber(created!.number);
    for (const ticket of tickets) {
      await moveTicketToTrashInTx(tx, {
        ticketId: ticket.id,
        reason: `Arrepentimiento del comprador (${number})`,
        deletedByUserId: null,
      });
    }

    return {
      id: created!.id,
      number,
      requestedAt: new Date(created!.requestedAt).toISOString(),
      purchase,
    };
  });
}

// ── Backoffice ───────────────────────────────────────────────────────────────

export async function listWithdrawalRequests(
  db: Db,
  status: 'PENDING_REFUND' | 'REFUNDED',
) {
  const rows = await db
    .select({
      id: withdrawalRequest.id,
      number: withdrawalRequest.number,
      ticketGroupId: withdrawalRequest.ticketGroupId,
      eventName: withdrawalRequest.eventName,
      ticketCount: withdrawalRequest.ticketCount,
      fullName: withdrawalRequest.fullName,
      mail: withdrawalRequest.mail,
      dni: withdrawalRequest.dni,
      amount: withdrawalRequest.amount,
      serviceFeeAmount: withdrawalRequest.serviceFeeAmount,
      paymentMethod: withdrawalRequest.paymentMethod,
      paidAt: withdrawalRequest.paidAt,
      refundAccount: withdrawalRequest.refundAccount,
      status: withdrawalRequest.status,
      requestedAt: withdrawalRequest.requestedAt,
      refundedAt: withdrawalRequest.refundedAt,
      refundedByName: user.fullName,
    })
    .from(withdrawalRequest)
    .leftJoin(user, eq(user.id, withdrawalRequest.refundedByUserId))
    .where(eq(withdrawalRequest.status, status))
    // Por reintegrar: el más viejo primero, que es el más urgente.
    .orderBy(
      status === 'PENDING_REFUND'
        ? asc(withdrawalRequest.requestedAt)
        : desc(withdrawalRequest.refundedAt),
    );

  return rows.map((row) => ({
    ...row,
    number: formatWithdrawalNumber(row.number),
    amount: Number(row.amount),
    serviceFeeAmount: Number(row.serviceFeeAmount),
  }));
}

export async function countPendingWithdrawals(db: Db) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalRequest)
    .where(eq(withdrawalRequest.status, 'PENDING_REFUND'));
  return Number(row?.count ?? 0);
}

/** Null si el trámite no existe o ya estaba reintegrado. */
export async function markWithdrawalRefunded(
  db: Db,
  id: string,
  refundedByUserId: string,
) {
  const [updated] = await db
    .update(withdrawalRequest)
    .set({
      status: 'REFUNDED',
      refundedAt: sql`now()`,
      refundedByUserId,
    })
    .where(
      and(
        eq(withdrawalRequest.id, id),
        eq(withdrawalRequest.status, 'PENDING_REFUND'),
      ),
    )
    .returning({ number: withdrawalRequest.number });
  return updated ? formatWithdrawalNumber(updated.number) : null;
}
