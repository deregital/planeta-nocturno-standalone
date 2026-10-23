/**
 * Pantallas de administración con un evento de 5000 entradas y un tenant con
 * historial (20 eventos anteriores, 100.000 entradas, ~60.000 compradores).
 */
import { performance } from 'node:perf_hooks';

import { generatePdf } from '@/server/utils/ticket-template';
import { callerFor, loadInstance } from '@tests/load/lib/caller';
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
import { errorMessage, payloadBytes, timed } from '@tests/load/lib/stats';

async function measure(name: string, fn: () => Promise<unknown>) {
  resetQueryCount();
  const heapBefore = process.memoryUsage().heapUsed;
  try {
    const r = await timed(fn);
    return {
      name,
      ms: Math.round(r.ms),
      queries: getQueryCount(),
      payloadMB: Math.round((payloadBytes(r.value) / 1e6) * 100) / 100,
      heapDeltaMB: Math.round(
        (process.memoryUsage().heapUsed - heapBefore) / 1e6,
      ),
    };
  } catch (error) {
    return { name, error: errorMessage(error) };
  }
}

export default async function run(log: (...a: unknown[]) => void) {
  const dbName = await createScenarioDatabase('backoffice');
  const { db, raw, close } = await openLoadDb(dbName);
  try {
    const adminId = await insertUser(raw, 'ADMIN');
    await insertHistory(raw, {
      events: 20,
      groupsPerEvent: 2000,
      dniPool: 60_000,
    });
    const { eventId, ticketTypeIds } = await insertEvent(raw, {
      name: 'Backoffice 5000',
      ticketTypes: [
        { name: 'General', price: 15000, maxAvailable: 4000 },
        { name: 'VIP', price: 30000, maxAvailable: 1000 },
      ],
    });
    await insertSoldTickets(raw, {
      eventId,
      ticketTypeIds,
      groups: 2000,
      scannedRatio: 0.7,
    });
    await raw.query('ANALYZE');
    const admin = callerFor(db, { id: adminId, role: 'ADMIN' });
    const lastMonth = {
      from: new Date(Date.now() - 30 * 86_400_000),
      to: new Date(Date.now() + 30 * 86_400_000),
    };

    const results: unknown[] = [];
    const steps: [string, () => Promise<unknown>][] = [
      [
        'emittedTickets.getByEventId (tabla de tickets)',
        () => admin.emittedTickets.getByEventId({ eventId }),
      ],
      [
        'emittedTickets.getAllUniqueBuyer (base de datos)',
        () => admin.emittedTickets.getAllUniqueBuyer(),
      ],
      [
        'statistics.getStatistics (evento)',
        () => admin.statistics.getStatistics({ ...lastMonth, eventId }),
      ],
      [
        'statistics.getStatistics (último mes)',
        () => admin.statistics.getStatistics(lastMonth),
      ],
      [
        'statistics.getEmittedTicketsPerHour',
        () =>
          admin.statistics.getEmittedTicketsPerHour({ ...lastMonth, eventId }),
      ],
      [
        'events.generatePresentismoOrderNamePDF',
        () => admin.events.generatePresentismoOrderNamePDF({ eventId }),
      ],
      [
        'events.generatePresentismoGroupedTicketTypePDF',
        () => admin.events.generatePresentismoGroupedTicketTypePDF({ eventId }),
      ],
      [
        'events.exportXlsxByTicketType',
        () => admin.events.exportXlsxByTicketType(eventId),
      ],
    ];
    for (const [name, fn] of steps) {
      const r = await measure(name, fn);
      results.push(r);
      log(JSON.stringify(r));
    }

    // Costo de CPU de los PDFs de entradas (webhook y checkout gratis los generan en el request).
    const { rows } = await raw.query(
      `SELECT id, "fullName", dni, slug, "createdAt" FROM "emittedTicket" WHERE "eventId" = $1 LIMIT 50`,
      [eventId],
    );
    const start = performance.now();
    for (const t of rows) {
      await generatePdf(
        {
          eventName: 'Backoffice 5000',
          startingDate: null,
          eventStartingDate: new Date().toISOString(),
          eventLocation: 'Av. Siempre Viva 123',
          createdAt: t.createdAt,
          dni: t.dni,
          fullName: t.fullName,
          id: t.id,
          ticketType: 'General',
          invitedBy: '-',
          slug: t.slug,
          ticketSlugVisibleInPdf: false,
        },
        loadInstance,
      );
    }
    const perPdfMs = (performance.now() - start) / rows.length;
    const pdf = {
      name: 'generatePdf (entrada individual)',
      perPdfMs: Math.round(perPdfMs),
      cpuSecondsFor5000: Math.round((perPdfMs * 5000) / 1000),
    };
    results.push(pdf);
    log(JSON.stringify(pdf));

    return { results };
  } finally {
    await close();
  }
}
