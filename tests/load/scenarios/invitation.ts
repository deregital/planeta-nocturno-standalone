/**
 * Modo invitación a volumen:
 *  - colisiones del código de 6 hex (único por evento: clave ("eventId", code))
 *  - canje de invitaciones con 5000 cupos y miles ya canjeados
 */
import { callerFor } from '@tests/load/lib/caller';
import {
  createScenarioDatabase,
  getQueryCount,
  openLoadDb,
  resetQueryCount,
} from '@tests/load/lib/db';
import { redeemInvitation } from '@tests/load/lib/invitation';
import { insertInvitationEvent, insertUser } from '@tests/load/lib/seed';
import {
  countBy,
  errorMessage,
  runPool,
  summarize,
  timed,
} from '@tests/load/lib/stats';

const CODE_SPACE = 16 ** 6;

function expectedCollisionProbability(existing: number, inserted: number) {
  const pairs = inserted * existing + (inserted * (inserted - 1)) / 2;
  return 1 - Math.exp(-pairs / CODE_SPACE);
}

function invitationEventInput(
  name: string,
  organizer: { id: string; dni: string },
  ticketAmount: number,
) {
  return {
    event: {
      name,
      description: 'Evento por invitación',
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
        maxAvailable: ticketAmount,
        maxSellDate: null,
        category: 'FREE' as const,
        startingDate: null,
        scanLimit: null,
        allowMultipleScans: false,
        visibleInWeb: true,
        lowStockThreshold: null,
      },
      {
        // El formulario de creación agrega este tipo cuando hay organizadores.
        id: crypto.randomUUID(),
        name: 'Organizador',
        description: 'Tickets para los organizadores',
        price: 0,
        maxPerPurchase: 1,
        maxAvailable: 1,
        maxSellDate: null,
        category: 'FREE' as const,
        startingDate: null,
        scanLimit: null,
        allowMultipleScans: false,
        visibleInWeb: false,
        lowStockThreshold: null,
      },
    ],
    organizersInput: [
      {
        id: organizer.id,
        dni: organizer.dni,
        fullName: 'Organizador',
        phoneNumber: '+5491155550000',
        role: 'ORGANIZER' as const,
        type: 'INVITATION' as const,
        ticketAmount,
      },
    ],
    sendOrganizerTicketEmail: false,
    questions: [],
  };
}

/** events.create real (admin) creando N códigos de una vez. */
async function codeCollisions(log: (...a: unknown[]) => void) {
  const dbName = await createScenarioDatabase('invitation_codes');
  const { db, raw, close } = await openLoadDb(dbName);
  try {
    const adminId = await insertUser(raw, 'ADMIN');
    const organizerId = await insertUser(raw, 'ORGANIZER');
    const { rows } = await raw.query(`SELECT dni FROM "user" WHERE id = $1`, [
      organizerId,
    ]);
    const organizer = { id: organizerId, dni: rows[0].dni as string };
    const admin = callerFor(db, { id: adminId, role: 'ADMIN' });

    const trialsPerSize = 12;
    const runs: unknown[] = [];

    // Tabla vacía: un evento nuevo con N invitaciones (se borra entre intentos).
    for (const size of [1000, 2500, 5000]) {
      let failures = 0;
      const reasons: string[] = [];
      for (let t = 0; t < trialsPerSize; t++) {
        try {
          const { eventCreated } = await admin.events.create(
            invitationEventInput(`Codes ${size} ${t}`, organizer, size),
          );
          await raw.query(
            `DELETE FROM "ticketXOrganizer" WHERE "eventId" = $1`,
            [eventCreated.id],
          );
        } catch (error) {
          failures += 1;
          reasons.push(errorMessage(error));
        }
      }
      const run = {
        existingCodes: 0,
        codesPerEvent: size,
        trials: trialsPerSize,
        failedEventCreations: failures,
        expectedFailureRate:
          Math.round(expectedCollisionProbability(0, size) * 1000) / 10,
        observedFailureRate: Math.round((failures / trialsPerSize) * 1000) / 10,
        sampleError: reasons[0],
      };
      runs.push(run);
      log('colisiones de códigos:', run);
    }

    // Tenant con historia: 40.000 códigos de eventos anteriores, evento nuevo de 500.
    await raw.query(
      `INSERT INTO "ticketXOrganizer" ("organizerId", "eventId", code, "shortId")
       SELECT $1, e.id, upper(lpad(to_hex(n), 6, '0')), n
       FROM generate_series(1, 40000) n,
            (SELECT id FROM event ORDER BY "createdAt" LIMIT 1) e`,
      [organizerId],
    );
    let failures = 0;
    for (let t = 0; t < trialsPerSize; t++) {
      try {
        const { eventCreated } = await admin.events.create(
          invitationEventInput(`History ${t}`, organizer, 500),
        );
        await raw.query(`DELETE FROM "ticketXOrganizer" WHERE "eventId" = $1`, [
          eventCreated.id,
        ]);
      } catch {
        failures += 1;
      }
    }
    const withHistory = {
      existingCodes: 40_000,
      codesPerEvent: 500,
      trials: trialsPerSize,
      failedEventCreations: failures,
      // Los 40.000 están en otro evento y no comparten el espacio de códigos.
      expectedFailureRate:
        Math.round(expectedCollisionProbability(0, 500) * 1000) / 10,
      observedFailureRate: Math.round((failures / trialsPerSize) * 1000) / 10,
    };
    runs.push(withHistory);
    log('colisiones con historial:', withHistory);
    return runs;
  } finally {
    await close();
  }
}

/** Fiesta por invitación de 5000: 3000 ya canjearon, llegan 200 invitados más. */
async function redemptionAtVolume(log: (...a: unknown[]) => void) {
  const runs: unknown[] = [];
  for (const rttMs of [0, 20]) {
    const dbName = await createScenarioDatabase(`invitation_volume_${rttMs}`);
    const { db, raw, close } = await openLoadDb(dbName, { rttMs, poolMax: 50 });
    try {
      const chiefId = await insertUser(raw, 'CHIEF_ORGANIZER');
      const organizers = [{ id: chiefId, ticketAmount: 0 }];
      for (let i = 0; i < 20; i++) {
        organizers.push({
          id: await insertUser(raw, 'ORGANIZER', { chiefOrganizerId: chiefId }),
          ticketAmount: 250,
        });
      }
      const { eventId, slug } = await insertInvitationEvent(raw, {
        name: `Invitacion 5000 ${rttMs}`,
        organizers,
        usedRatio: 0.6,
      });
      await raw.query('ANALYZE');
      const free = (
        await raw.query(
          `SELECT code FROM "ticketXOrganizer" WHERE "eventId" = $1 AND "ticketId" IS NULL ORDER BY random() LIMIT 200`,
          [eventId],
        )
      ).rows.map((r) => r.code as string);
      const caller = callerFor(db);

      const single = await timed(() =>
        redeemInvitation(caller, db, {
          eventId,
          slug,
          code: free[0],
          guestIndex: 0,
        }),
      );
      resetQueryCount();
      const guests = 100;
      const wall = await timed(() =>
        runPool(
          guests,
          50,
          async (i) =>
            (
              await timed(() =>
                redeemInvitation(caller, db, {
                  eventId,
                  slug,
                  code: free[i + 1],
                  guestIndex: i + 1,
                }),
              )
            ).ms,
        ),
      );
      const ok = wall.value
        .filter(
          (r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled',
        )
        .map((r) => r.value);
      const run = {
        rttMs,
        assignedCodes: 5000,
        alreadyRedeemed: 3000,
        singleRedemptionMs: Math.round(single.ms),
        concurrentGuests: guests,
        concurrency: 50,
        wallMs: Math.round(wall.ms),
        latency: summarize(ok),
        failed: wall.value.length - ok.length,
        failures: countBy(
          wall.value.filter((r) => r.status === 'rejected'),
          (r) => errorMessage((r as PromiseRejectedResult).reason),
        ),
        queriesPerRedemption: Math.round((getQueryCount() / guests) * 10) / 10,
      };
      runs.push(run);
      log('canje de invitaciones a volumen:', run);
    } finally {
      await close();
    }
  }
  return runs;
}

export default async function run(log: (...a: unknown[]) => void) {
  return {
    codeCollisions: await codeCollisions(log),
    redemptionAtVolume: await redemptionAtVolume(log),
  };
}
