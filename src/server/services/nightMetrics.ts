import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import {
  emittedTicket,
  emittedTicketScan,
  event,
  ticketGroup,
  ticketType,
  user,
} from '@/drizzle/schema';
import { notWithdrawn } from '@/server/services/withdrawal';

/**
 * Métricas de la noche: la única cuenta de entradas, ingresos y recaudado que
 * leen todas las pantallas (organizador, admin de la productora, /control y
 * Pluto). Lo que cambia entre ellas es el alcance, no la definición.
 *
 * - **Entrada de la noche**: la de una compra pagada o gratis, o una reserva a
 *   cobrar en el lugar. Las de los organizadores van aparte. Las reservas sin
 *   pagar (por cualquier otro medio, o un checkout sin terminar) tampoco
 *   cuentan: se informan aparte como `unpaid`.
 * - **Ingresó**: la entrada está escaneada y su primer escaneo cae dentro del
 *   horario de la noche (de 6 horas antes de que empiece a 6 horas después de
 *   que termine). Un escaneo fuera de ese horario es una prueba: la entrada ya
 *   no está pendiente, pero no suma como ingreso (`scannedOutsideWindow`).
 *   Así `entered + scannedOutsideWindow + pending = valid`.
 * - **Hora de ingreso**: el primer escaneo de la entrada. Con multiescaneo,
 *   los reingresos no cuentan de nuevo.
 * - **Recaudado**: el total de las compras pagadas, sin las arrepentidas. Es
 *   lo que se cobró en cada compra, no el precio actual del tipo de entrada.
 */
export const ENTRY_WINDOW_HOURS_BEFORE_START = 6;
export const ENTRY_WINDOW_HOURS_AFTER_END = 6;
/** Un evento sin hora de fin se toma como de 12 horas. */
const DEFAULT_EVENT_HOURS = 12;

/**
 * - `all`: todas las entradas del evento (admin, /control, Pluto).
 * - `invitedBy`: sólo las compras e invitaciones de esos usuarios (el
 *   organizador ve las suyas; el jefe, las de su equipo).
 */
export type NightMetricsScope =
  | { kind: 'all' }
  | { kind: 'invitedBy'; userIds: string[] };

export type NightMetricsCount = { valid: number; entered: number };

export type NightMetrics = {
  event: {
    id: string;
    slug: string;
    name: string;
    startingDate: string | null;
    endingDate: string | null;
    inviteCondition: 'TRADITIONAL' | 'INVITATION' | 'SIMPLE';
  };
  /** Hora de la base cuando se calcularon. */
  asOf: string;
  tickets: {
    valid: number;
    /** Entradas de compras con precio (pagas o a cobrar en el lugar). */
    sold: number;
    entered: number;
    pending: number;
    scannedOutsideWindow: number;
  };
  organizers: NightMetricsCount;
  /**
   * Entradas de reservas sin pagar, por medio de pago. `checkout` es una
   * compra que no llegó a elegir medio; `other`, un medio sin balde propio.
   */
  unpaid: {
    mercadoPago: number;
    transfer: number;
    checkout: number;
    other: number;
  };
  raised: number;
  firstEntryAt: string | null;
  lastEntryAt: string | null;
  byTicketType: (NightMetricsCount & {
    id: string;
    name: string;
    category: 'FREE' | 'PAID' | 'TABLE';
  })[];
  /** Por quien vendió o invitó; `id: null` es la venta sin organizador. */
  byOrganizer: (NightMetricsCount & { id: string | null; name: string })[];
  /** Ingresos por minuto (sólo los minutos con ingresos), en orden. */
  entriesPerMinute: { minute: string; entries: number }[];
};

type TicketKind = 'valid' | 'organizer' | 'unpaid';

const ticketKind = sql<TicketKind>`case
  when ${ticketGroup.isOrganizerGroup} then 'organizer'
  when ${ticketGroup.status} <> 'BOOKED' or ${ticketGroup.paymentMethod} = 'ON_SITE' then 'valid'
  else 'unpaid'
end`;

const firstScanAt = sql<
  string | null
>`case when ${emittedTicket.scanned} then coalesce(
  (select min(${emittedTicketScan.scannedAt}) from ${emittedTicketScan}
    where ${emittedTicketScan.emittedTicketId} = ${emittedTicket.id}),
  ${emittedTicket.scannedAt}
) end`;

const windowStart = sql<string>`${event.startingDate} - make_interval(hours => ${ENTRY_WINDOW_HOURS_BEFORE_START})`;
const windowEnd = sql<string>`coalesce(${event.endingDate}, ${event.startingDate} + make_interval(hours => ${DEFAULT_EVENT_HOURS})) + make_interval(hours => ${ENTRY_WINDOW_HOURS_AFTER_END})`;

function scopeCondition(scope: NightMetricsScope): SQL | undefined {
  if (scope.kind === 'all') return undefined;
  if (scope.userIds.length === 0) return sql`false`;
  return inArray(ticketGroup.invitedById, scope.userIds);
}

function toIso(value: string | Date | null | undefined) {
  return value == null ? null : new Date(value).toISOString();
}

function emptyMetrics(
  eventRow: NightMetrics['event'],
  asOf: string,
): NightMetrics {
  return {
    event: eventRow,
    asOf,
    tickets: {
      valid: 0,
      sold: 0,
      entered: 0,
      pending: 0,
      scannedOutsideWindow: 0,
    },
    organizers: { valid: 0, entered: 0 },
    unpaid: { mercadoPago: 0, transfer: 0, checkout: 0, other: 0 },
    raised: 0,
    firstEntryAt: null,
    lastEntryAt: null,
    byTicketType: [],
    byOrganizer: [],
    entriesPerMinute: [],
  };
}

/**
 * Métricas de varias noches de una misma base, en pocas consultas (no una por
 * evento). Devuelve sólo los eventos que existen, en el orden pedido.
 */
export async function getNightMetrics(
  db: Db,
  eventIds: string[],
  scope: NightMetricsScope = { kind: 'all' },
): Promise<NightMetrics[]> {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) return [];

  const [events, ticketTypes] = await Promise.all([
    db
      .select({
        id: event.id,
        slug: event.slug,
        name: event.name,
        startingDate: event.startingDate,
        endingDate: event.endingDate,
        inviteCondition: event.inviteCondition,
        asOf: sql<string>`now()`,
      })
      .from(event)
      .where(and(inArray(event.id, ids), eq(event.isDeleted, false))),
    db
      .select({
        id: ticketType.id,
        eventId: ticketType.eventId,
        name: ticketType.name,
        category: ticketType.category,
        sortOrder: ticketType.sortOrder,
      })
      .from(ticketType)
      .where(inArray(ticketType.eventId, ids)),
  ]);
  if (events.length === 0) return [];

  const foundIds = events.map((row) => row.id);
  const scopeFilter = scopeCondition(scope);

  const nightTicket = db
    .select({
      eventId: emittedTicket.eventId,
      ticketTypeId: emittedTicket.ticketTypeId,
      invitedById: ticketGroup.invitedById,
      groupStatus: ticketGroup.status,
      paymentMethod: ticketGroup.paymentMethod,
      kind: ticketKind.as('kind'),
      entryAt: firstScanAt.as('entry_at'),
      windowStart: windowStart.as('window_start'),
      windowEnd: windowEnd.as('window_end'),
    })
    .from(emittedTicket)
    .innerJoin(ticketGroup, eq(ticketGroup.id, emittedTicket.ticketGroupId))
    .innerJoin(event, eq(event.id, emittedTicket.eventId))
    .where(and(inArray(emittedTicket.eventId, foundIds), scopeFilter))
    .as('night_ticket');

  const inWindow = sql`${nightTicket.entryAt} between ${nightTicket.windowStart} and ${nightTicket.windowEnd}`;

  const [groups, curve, raisedRows] = await Promise.all([
    db
      .select({
        eventId: nightTicket.eventId,
        ticketTypeId: nightTicket.ticketTypeId,
        invitedById: nightTicket.invitedById,
        groupStatus: nightTicket.groupStatus,
        paymentMethod: nightTicket.paymentMethod,
        kind: nightTicket.kind,
        tickets: sql<number>`count(*)::int`,
        scanned: sql<number>`count(${nightTicket.entryAt})::int`,
        entered: sql<number>`(count(*) filter (where ${inWindow}))::int`,
        firstEntryAt: sql<
          string | null
        >`min(${nightTicket.entryAt}) filter (where ${inWindow})`,
        lastEntryAt: sql<
          string | null
        >`max(${nightTicket.entryAt}) filter (where ${inWindow})`,
      })
      .from(nightTicket)
      .groupBy(
        nightTicket.eventId,
        nightTicket.ticketTypeId,
        nightTicket.invitedById,
        nightTicket.groupStatus,
        nightTicket.paymentMethod,
        nightTicket.kind,
      ),
    db
      .select({
        eventId: nightTicket.eventId,
        minute: sql<string>`date_trunc('minute', ${nightTicket.entryAt})`,
        entries: sql<number>`count(*)::int`,
      })
      .from(nightTicket)
      .where(and(eq(nightTicket.kind, 'valid'), inWindow))
      .groupBy(
        nightTicket.eventId,
        sql`date_trunc('minute', ${nightTicket.entryAt})`,
      )
      .orderBy(sql`date_trunc('minute', ${nightTicket.entryAt})`),
    db
      .select({
        eventId: ticketGroup.eventId,
        raised: sql<string>`coalesce(sum(${ticketGroup.totalAmount}), 0)`,
      })
      .from(ticketGroup)
      .where(
        and(
          inArray(ticketGroup.eventId, foundIds),
          eq(ticketGroup.status, 'PAID'),
          eq(ticketGroup.isOrganizerGroup, false),
          notWithdrawn,
          scopeFilter,
        ),
      )
      .groupBy(ticketGroup.eventId),
  ]);

  const organizerIds = [
    ...new Set(
      groups
        .filter((row) => row.kind === 'valid' && row.invitedById)
        .map((row) => row.invitedById!),
    ),
  ];
  const organizerNames = new Map(
    organizerIds.length === 0
      ? []
      : (
          await db
            .select({ id: user.id, fullName: user.fullName })
            .from(user)
            .where(inArray(user.id, organizerIds))
        ).map((row) => [row.id, row.fullName]),
  );

  const byEvent = new Map<string, NightMetrics>();
  for (const row of events) {
    byEvent.set(
      row.id,
      emptyMetrics(
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          startingDate: toIso(row.startingDate),
          endingDate: toIso(row.endingDate),
          inviteCondition: row.inviteCondition,
        },
        toIso(row.asOf)!,
      ),
    );
  }

  const typesByEvent = new Map<string, typeof ticketTypes>();
  for (const type of ticketTypes) {
    const list = typesByEvent.get(type.eventId) ?? [];
    list.push(type);
    typesByEvent.set(type.eventId, list);
  }
  const typeCounts = new Map<string, NightMetricsCount>();
  const organizerCounts = new Map<
    string,
    Map<string | null, NightMetricsCount>
  >();

  for (const row of groups) {
    const metrics = byEvent.get(row.eventId);
    if (!metrics) continue;

    if (row.kind === 'organizer') {
      metrics.organizers.valid += row.tickets;
      metrics.organizers.entered += row.entered;
      continue;
    }

    if (row.kind === 'unpaid') {
      if (row.paymentMethod === 'MERCADO_PAGO') {
        metrics.unpaid.mercadoPago += row.tickets;
      } else if (row.paymentMethod === 'TRANSFER') {
        metrics.unpaid.transfer += row.tickets;
      } else if (row.paymentMethod === null) {
        metrics.unpaid.checkout += row.tickets;
      } else {
        metrics.unpaid.other += row.tickets;
      }
      continue;
    }

    metrics.tickets.valid += row.tickets;
    if (row.groupStatus !== 'FREE') metrics.tickets.sold += row.tickets;
    metrics.tickets.entered += row.entered;
    metrics.tickets.scannedOutsideWindow += row.scanned - row.entered;
    metrics.tickets.pending += row.tickets - row.scanned;
    metrics.firstEntryAt = earliest(metrics.firstEntryAt, row.firstEntryAt);
    metrics.lastEntryAt = latest(metrics.lastEntryAt, row.lastEntryAt);

    const typeCount = typeCounts.get(row.ticketTypeId) ?? {
      valid: 0,
      entered: 0,
    };
    typeCount.valid += row.tickets;
    typeCount.entered += row.entered;
    typeCounts.set(row.ticketTypeId, typeCount);

    const eventOrganizers =
      organizerCounts.get(row.eventId) ??
      new Map<string | null, NightMetricsCount>();
    const organizerCount = eventOrganizers.get(row.invitedById) ?? {
      valid: 0,
      entered: 0,
    };
    organizerCount.valid += row.tickets;
    organizerCount.entered += row.entered;
    eventOrganizers.set(row.invitedById, organizerCount);
    organizerCounts.set(row.eventId, eventOrganizers);
  }

  for (const metrics of byEvent.values()) {
    metrics.byTicketType = (typesByEvent.get(metrics.event.id) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((type) => ({
        id: type.id,
        name: type.name,
        category: type.category,
        ...(typeCounts.get(type.id) ?? { valid: 0, entered: 0 }),
      }))
      // El tipo "Organizador" y los que no tienen entradas no suman nada.
      .filter((type) => type.valid > 0);

    metrics.byOrganizer = [
      ...(organizerCounts.get(metrics.event.id) ?? new Map()).entries(),
    ]
      .map(([id, count]) => ({
        id,
        name: id
          ? (organizerNames.get(id) ?? 'Organizador eliminado')
          : 'Sin organizador',
        ...count,
      }))
      .sort((a, b) => b.valid - a.valid || a.name.localeCompare(b.name));
  }

  for (const row of curve) {
    byEvent.get(row.eventId)?.entriesPerMinute.push({
      minute: toIso(row.minute)!,
      entries: row.entries,
    });
  }

  for (const row of raisedRows) {
    const metrics = byEvent.get(row.eventId);
    if (metrics) metrics.raised = Number(row.raised);
  }

  return ids.flatMap((id) => byEvent.get(id) ?? []);
}

function earliest(current: string | null, candidate: string | null) {
  const value = toIso(candidate);
  if (!value) return current;
  return !current || value < current ? value : current;
}

function latest(current: string | null, candidate: string | null) {
  const value = toIso(candidate);
  if (!value) return current;
  return !current || value > current ? value : current;
}
