import { TRPCError } from '@trpc/server';
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { type Db } from '@/drizzle';

import {
  emittedTicket,
  emittedTicketScan,
  event as eventTable,
  eventScannerConfig,
  scanReceipt,
  ticketGroup,
  ticketType as ticketTypeTable,
  user,
} from '@/drizzle/schema';
import {
  clampMaxStaleSeconds,
  combineConfigs,
  DEFAULT_MAX_STALE_SECONDS,
  DELTA_OVERLAP_MS,
  dniTail,
  isScannerMode,
  isTicketId,
  MAX_SCANNER_EVENTS,
  MAX_SYNC_SCANS,
  OFF_CONFIG,
  SCANNER_MODES,
  SCANNER_PROTOCOL_VERSION,
  type DeltaScanRow,
  type ScannerConfig,
  type SnapshotTicketRow,
  type SnapshotTicketType,
  type SyncScanOutcome,
} from '@/lib/scan/protocol';
import { logger } from '@/server/observability/logger';
import { permissionProcedure, router } from '@/server/trpc';
import { tryRegisterTicketScanInTx } from '@/server/utils/register-ticket-scan';
import { assertEventsAccess } from '@/server/utils/scanner-access';
import {
  getLegacyQrKeyBase64,
  isScannerLocalModeAvailable,
  serverTicketHash,
} from '@/server/utils/scanner-crypto';
import { decryptString } from '@/server/utils/utils';

const eventIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(MAX_SCANNER_EVENTS)
  .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]);

type EventConfigRow = { eventId: string; name: string } & ScannerConfig;

/** 42P01: la migración de las tablas nuevas todavía no llegó a esta base. */
function isMissingTable(error: unknown) {
  const cause = (error as { cause?: { code?: string }; code?: string }) ?? {};
  return cause.code === '42P01' || cause.cause?.code === '42P01';
}

/** Código estable para filtrar en PostHog Logs. */
export const SCANNER_MIGRATION_MISSING = 'SCANNER_MIGRATION_MISSING';
export const SCANNER_MIGRATION_MISSING_MESSAGE =
  'Falta actualizar la base de datos de esta productora para usar el escaneo rápido. Avisale al equipo técnico.';

/**
 * Escribir en las tablas nuevas sin la migración: error claro para quien lo
 * pidió (no el SQL crudo) y un log con lo que hay que hacer.
 */
function migrationMissing(operation: string) {
  logger.error(
    'Scanner tables missing in this tenant: run `npm run migrate:tenants`',
    { operation, code: SCANNER_MIGRATION_MISSING },
  );
  return new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: SCANNER_MIGRATION_MISSING_MESSAGE,
  });
}

async function loadEventConfigs(
  db: Db,
  eventIds: string[],
): Promise<EventConfigRow[]> {
  const events = await db
    .select({ id: eventTable.id, name: eventTable.name })
    .from(eventTable)
    .where(inArray(eventTable.id, eventIds));

  let rows: { eventId: string; mode: string; maxStaleSeconds: number }[] = [];
  try {
    rows = await db
      .select({
        eventId: eventScannerConfig.eventId,
        mode: eventScannerConfig.mode,
        maxStaleSeconds: eventScannerConfig.maxStaleSeconds,
      })
      .from(eventScannerConfig)
      .where(inArray(eventScannerConfig.eventId, eventIds));
  } catch (error) {
    // Sin la tabla, todos los eventos escanean como siempre.
    if (!isMissingTable(error)) throw error;
    logger.warn('Scanner config table missing: every event scans as usual', {
      operation: 'scanner_config',
      code: SCANNER_MIGRATION_MISSING,
    });
  }

  const byEvent = new Map(rows.map((row) => [row.eventId, row]));
  return eventIds.map((eventId) => {
    const row = byEvent.get(eventId);
    return {
      eventId,
      name: events.find((e) => e.id === eventId)?.name ?? '',
      mode: row && isScannerMode(row.mode) ? row.mode : 'off',
      maxStaleSeconds: clampMaxStaleSeconds(
        row?.maxStaleSeconds ?? DEFAULT_MAX_STALE_SECONDS,
      ),
    };
  });
}

async function effectiveConfig(db: Db, eventIds: string[]) {
  if (!isScannerLocalModeAvailable()) return OFF_CONFIG;
  return combineConfigs(await loadEventConfigs(db, eventIds));
}

async function loadTicketTypes(
  db: Db,
  eventIds: string[],
): Promise<SnapshotTicketType[]> {
  return db
    .select({
      id: ticketTypeTable.id,
      name: ticketTypeTable.name,
      allowMultipleScans: ticketTypeTable.allowMultipleScans,
      startingDate: ticketTypeTable.startingDate,
      scanLimit: ticketTypeTable.scanLimit,
    })
    .from(ticketTypeTable)
    .where(inArray(ticketTypeTable.eventId, eventIds));
}

async function loadScanCounts(
  db: Db,
  eventIds: string[],
  scannedSince: string | null,
) {
  const rows = await db
    .select({ ticketId: emittedTicketScan.emittedTicketId, total: count() })
    .from(emittedTicketScan)
    .innerJoin(
      emittedTicket,
      eq(emittedTicket.id, emittedTicketScan.emittedTicketId),
    )
    .where(
      and(
        inArray(emittedTicket.eventId, eventIds),
        scannedSince ? gte(emittedTicket.scannedAt, scannedSince) : undefined,
      ),
    )
    .groupBy(emittedTicketScan.emittedTicketId);
  return new Map(rows.map((row) => [row.ticketId, Number(row.total)]));
}

/** Entradas de los eventos (todas, o las creadas desde `createdSince`). */
async function loadTicketRows(
  db: Db,
  eventIds: string[],
  createdSince: string | null,
): Promise<SnapshotTicketRow[]> {
  const tickets = await db
    .select({
      id: emittedTicket.id,
      eventId: emittedTicket.eventId,
      ticketTypeId: emittedTicket.ticketTypeId,
      fullName: emittedTicket.fullName,
      dni: emittedTicket.dni,
      scanned: emittedTicket.scanned,
      scannedAt: emittedTicket.scannedAt,
      invitedBy: user.fullName,
    })
    .from(emittedTicket)
    .leftJoin(ticketGroup, eq(ticketGroup.id, emittedTicket.ticketGroupId))
    .leftJoin(user, eq(user.id, ticketGroup.invitedById))
    .where(
      and(
        inArray(emittedTicket.eventId, eventIds),
        createdSince ? gte(emittedTicket.createdAt, createdSince) : undefined,
      ),
    );
  if (tickets.length === 0) return [];

  const counts = await loadScanCounts(db, eventIds, null);
  return tickets.map((ticket) => [
    serverTicketHash(ticket.id),
    ticket.eventId,
    ticket.ticketTypeId,
    ticket.fullName,
    dniTail(ticket.dni),
    ticket.invitedBy ?? null,
    ticket.scanned,
    ticket.scannedAt,
    counts.get(ticket.id) ?? 0,
  ]);
}

async function loadDelta(db: Db, eventIds: string[], cursor: string) {
  const since = new Date(Date.parse(cursor) - DELTA_OVERLAP_MS).toISOString();

  const [changed, counts, added, types, [{ total }]] = await Promise.all([
    db
      .select({
        id: emittedTicket.id,
        scanned: emittedTicket.scanned,
        scannedAt: emittedTicket.scannedAt,
      })
      .from(emittedTicket)
      .where(
        and(
          inArray(emittedTicket.eventId, eventIds),
          gte(emittedTicket.scannedAt, since),
        ),
      ),
    loadScanCounts(db, eventIds, since),
    loadTicketRows(db, eventIds, since),
    loadTicketTypes(db, eventIds),
    db
      .select({ total: count() })
      .from(emittedTicket)
      .where(inArray(emittedTicket.eventId, eventIds)),
  ]);

  const scans: DeltaScanRow[] = changed.map((ticket) => [
    serverTicketHash(ticket.id),
    ticket.scanned,
    ticket.scannedAt,
    counts.get(ticket.id) ?? 0,
  ]);

  return { scans, added, types, ticketCount: Number(total) };
}

function safeIso(epochMs: number): string | null {
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type SyncScanInput = { id: string; code: string; at: number };

export type SyncScanResult = {
  id: string;
  outcome: SyncScanOutcome;
  /** Hash de la entrada (null si no se encontró). */
  hash: string | null;
  /** Hora del registro de esta entrada en el servidor. */
  scannedAt: string | null;
  /** El registro previo (si hubo doble ingreso) fue de este mismo usuario. */
  scannedByMe: boolean;
};

/**
 * Registra un escaneo decidido en el celular. Todo en una transacción: el
 * recibo con `clientScanId` único se reclama primero, así dos subidas del
 * mismo escaneo (reintento con la respuesta perdida, o dos pedidos en vuelo)
 * producen un solo ingreso y la misma respuesta.
 */
async function registerLocalScan(
  db: Db,
  {
    eventIds,
    deviceId,
    userId,
    scan,
  }: {
    eventIds: string[];
    deviceId: string;
    userId: string;
    scan: SyncScanInput;
  },
): Promise<SyncScanResult> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .insert(scanReceipt)
      .values({
        clientScanId: scan.id,
        deviceId,
        userId,
        outcome: 'pending',
        localStatus: 'success',
        clientScannedAt: safeIso(scan.at),
      })
      .onConflictDoNothing({ target: scanReceipt.clientScanId })
      .returning({ id: scanReceipt.id });

    if (claimed.length === 0) {
      const [existing] = await tx
        .select({
          outcome: scanReceipt.outcome,
          emittedTicketId: scanReceipt.emittedTicketId,
          registeredAt: scanReceipt.registeredAt,
          userId: scanReceipt.userId,
        })
        .from(scanReceipt)
        .where(eq(scanReceipt.clientScanId, scan.id))
        .limit(1);
      const outcome = (existing?.outcome ?? 'not-found') as SyncScanOutcome;
      return {
        id: scan.id,
        outcome,
        hash: existing?.emittedTicketId
          ? serverTicketHash(existing.emittedTicketId)
          : null,
        scannedAt: existing?.registeredAt ?? null,
        scannedByMe: existing?.userId === userId,
      };
    }
    const receiptId = claimed[0].id;

    let ticketId: string | null = null;
    try {
      const decrypted = decryptString(scan.code);
      ticketId = isTicketId(decrypted) ? decrypted : null;
    } catch {
      ticketId = null;
    }

    const ticket = ticketId
      ? await tx.query.emittedTicket.findFirst({
          where: and(
            eq(emittedTicket.id, ticketId),
            inArray(emittedTicket.eventId, eventIds),
          ),
          columns: {
            id: true,
            eventId: true,
            scannedAt: true,
            scannedByUserId: true,
          },
          with: { ticketType: { columns: { allowMultipleScans: true } } },
        })
      : undefined;

    if (!ticket) {
      await tx
        .update(scanReceipt)
        .set({ outcome: 'not-found' })
        .where(eq(scanReceipt.id, receiptId));
      return {
        id: scan.id,
        outcome: 'not-found',
        hash: null,
        scannedAt: null,
        scannedByMe: false,
      };
    }

    const registration = await tryRegisterTicketScanInTx(
      tx,
      ticket.id,
      userId,
      ticket.ticketType.allowMultipleScans,
    );
    const outcome: SyncScanOutcome = registration.registered
      ? 'registered'
      : 'duplicate';

    await tx
      .update(scanReceipt)
      .set({
        outcome,
        eventId: ticket.eventId,
        emittedTicketId: ticket.id,
        registeredAt: registration.registered ? registration.scannedAt : null,
      })
      .where(eq(scanReceipt.id, receiptId));

    return {
      id: scan.id,
      outcome,
      hash: serverTicketHash(ticket.id),
      scannedAt: registration.registered
        ? registration.scannedAt
        : ticket.scannedAt,
      scannedByMe: registration.registered
        ? true
        : ticket.scannedByUserId === userId,
    };
  });
}

export const scannerRouter = router({
  /** Modo efectivo para la puerta y si este usuario puede cambiarlo. */
  config: permissionProcedure('scanner:use')
    .input(z.object({ eventIds: eventIdsSchema }))
    .query(async ({ ctx, input }) => {
      await assertEventsAccess(ctx, input.eventIds);
      const available = isScannerLocalModeAvailable();
      const events = available
        ? await loadEventConfigs(ctx.db, input.eventIds)
        : [];
      return {
        available,
        canEdit: available && ctx.can('events:update'),
        userId: ctx.session.user.id,
        effective: available ? combineConfigs(events) : OFF_CONFIG,
        events,
      };
    }),

  setConfig: permissionProcedure('scanner:use', 'events:update')
    .input(
      z.object({
        eventId: z.uuid(),
        mode: z.enum(SCANNER_MODES),
        maxStaleSeconds: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isScannerLocalModeAvailable()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'El modo local no está habilitado en esta instalación',
        });
      }
      await assertEventsAccess(ctx, [input.eventId]);

      const values = {
        mode: input.mode,
        maxStaleSeconds: clampMaxStaleSeconds(input.maxStaleSeconds),
        updatedAt: new Date().toISOString(),
        updatedByUserId: ctx.session.user.id,
      };
      try {
        await ctx.db
          .insert(eventScannerConfig)
          .values({ eventId: input.eventId, ...values })
          .onConflictDoUpdate({
            target: eventScannerConfig.eventId,
            set: values,
          });
      } catch (error) {
        if (isMissingTable(error)) throw migrationMissing('scanner_config');
        throw error;
      }

      logger.info('Scanner config changed', {
        operation: 'scanner_config',
        eventId: input.eventId,
        mode: values.mode,
        maxStaleSeconds: values.maxStaleSeconds,
        userId: ctx.session.user.id,
      });
      return { mode: values.mode, maxStaleSeconds: values.maxStaleSeconds };
    }),

  /**
   * Tabla de la puerta para decidir en el celular: hashes de las entradas
   * (nunca los ids), lo que muestra la tarjeta y la clave de los QR. Solo con
   * el modo sombra o local encendido para estos eventos.
   */
  snapshot: permissionProcedure('scanner:use')
    .input(
      z.object({
        protocol: z.literal(SCANNER_PROTOCOL_VERSION),
        eventIds: eventIdsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEventsAccess(ctx, input.eventIds);
      const serverNow = new Date().toISOString();
      const config = await effectiveConfig(ctx.db, input.eventIds);
      if (config.mode === 'off') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'El modo local está apagado para estos eventos',
        });
      }

      const startedAt = performance.now();
      const [events, types, tickets] = await Promise.all([
        ctx.db
          .select({ id: eventTable.id, name: eventTable.name })
          .from(eventTable)
          .where(inArray(eventTable.id, input.eventIds)),
        loadTicketTypes(ctx.db, input.eventIds),
        loadTicketRows(ctx.db, input.eventIds, null),
      ]);

      logger.info('Scanner snapshot', {
        operation: 'scanner_snapshot',
        eventIds: input.eventIds.join(','),
        tickets: tickets.length,
        userId: ctx.session.user.id,
        serverMs: Math.round(performance.now() - startedAt),
      });

      return {
        protocol: SCANNER_PROTOCOL_VERSION,
        serverNow,
        cursor: serverNow,
        config,
        key: getLegacyQrKeyBase64(),
        events,
        types,
        tickets,
      };
    }),

  /**
   * Sube los escaneos decididos en el celular y baja las novedades desde
   * `cursor`. Los escaneos se aceptan siempre (aunque se haya apagado el modo
   * local): nunca se pierde un ingreso que ya ocurrió.
   */
  sync: permissionProcedure('scanner:use')
    .input(
      z.object({
        protocol: z.literal(SCANNER_PROTOCOL_VERSION),
        eventIds: eventIdsSchema,
        deviceId: z.string().min(1).max(64),
        cursor: z.string().max(40).nullable(),
        scans: z
          .array(
            z.object({
              id: z.uuid(),
              code: z.string().min(1).max(512),
              at: z.number(),
            }),
          )
          .max(MAX_SYNC_SCANS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEventsAccess(ctx, input.eventIds);
      const startedAt = performance.now();

      const results: SyncScanResult[] = [];
      try {
        for (const scan of input.scans) {
          results.push(
            await registerLocalScan(ctx.db, {
              eventIds: input.eventIds,
              deviceId: input.deviceId,
              userId: ctx.session.user.id,
              scan,
            }),
          );
        }
      } catch (error) {
        // El celular conserva los pendientes y los vuelve a subir después.
        if (isMissingTable(error)) throw migrationMissing('scanner_sync');
        throw error;
      }

      // Las novedades se leen después de registrar lo subido, así lo propio
      // ya viene incluido.
      const serverNow = new Date().toISOString();
      const cursorValid =
        input.cursor && !Number.isNaN(Date.parse(input.cursor));
      const [config, delta] = await Promise.all([
        effectiveConfig(ctx.db, input.eventIds),
        cursorValid ? loadDelta(ctx.db, input.eventIds, input.cursor!) : null,
      ]);

      if (results.length > 0) {
        logger.info('Scanner sync', {
          operation: 'scanner_sync',
          pushed: results.length,
          registered: results.filter((r) => r.outcome === 'registered').length,
          duplicate: results.filter((r) => r.outcome === 'duplicate').length,
          notFound: results.filter((r) => r.outcome === 'not-found').length,
          deviceId: input.deviceId,
          serverMs: Math.round(performance.now() - startedAt),
        });
      }

      return {
        protocol: SCANNER_PROTOCOL_VERSION,
        serverNow,
        cursor: serverNow,
        config,
        results,
        delta,
      };
    }),
});
