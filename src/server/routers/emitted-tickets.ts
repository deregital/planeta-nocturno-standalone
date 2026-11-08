import { TRPCError } from '@trpc/server';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';

import {
  emittedTicket,
  event,
  location,
  ticketGroup,
  ticketTypePerGroup,
  ticketType as ticketTypeTable,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { ageFromBirthDate, dateToDateOnlyString } from '@/lib/date-only';
import {
  createManyTicketSchema,
  createTicketSchema,
  emittedTicketSchema,
} from '@/server/schemas/emitted-tickets';
import { logger } from '@/server/observability/logger';
import { assertTicketGroupEventNotBlocked } from '@/server/services/eventBlock';
import { sendMail } from '@/server/services/mail';
import {
  anyPermissionProcedure,
  forbidden,
  permissionProcedure,
  publicProcedure,
  router,
} from '@/server/trpc';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { getBuyersCodeByDni } from '@/server/utils/db/utils';
import { allocateEmittedTicketShortIds } from '@/server/utils/emittedTicketShortId';
import { generatePdf } from '@/server/utils/ticket-template';
import {
  formatLastScanTime,
  formatScanWindow,
  registerTicketScanInTx,
  tryRegisterTicketScan,
} from '@/server/utils/register-ticket-scan';
import { decryptString, generateSlug } from '@/server/utils/utils';

export const emittedTicketsRouter = router({
  create: permissionProcedure('tickets:create')
    .input(createTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const { alreadyEntered, allowOverQuota, ...ticketInput } = input;
      // Sin try/catch con tx.rollback(): ese rollback lanza su propio error y
      // tapaba el motivo real (p. ej. sin cupo). Drizzle revierte solo.
      const ticketCreated = await ctx.db.transaction(async (tx) => {
        // Bloqueado como en el checkout, para que dos emisiones a la vez no
        // pasen juntas el cupo.
        const [ticketType] = await tx
          .select()
          .from(ticketTypeTable)
          .where(
            and(
              eq(ticketTypeTable.id, input.ticketTypeId),
              eq(ticketTypeTable.eventId, input.eventId),
            ),
          )
          .for('update');
        if (!ticketType) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Tipo de entrada inválido para este evento',
          });
        }

        // El cupo de los organizadores lo maneja el reparto.
        if (
          !allowOverQuota &&
          ticketType.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim()
        ) {
          const [taken] = await tx
            .select({
              amount: sql<number>`coalesce(sum(${ticketTypePerGroup.amount}), 0)::int`,
            })
            .from(ticketTypePerGroup)
            .where(eq(ticketTypePerGroup.ticketTypeId, ticketType.id));
          if (Number(taken?.amount ?? 0) + 1 > ticketType.maxAvailable) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `No quedan entradas de ${ticketType.name} (cupo ${ticketType.maxAvailable}).`,
            });
          }
        }

        // Antes quedaba con total $0 y sin medio de pago, y la no cobrada
        // (BOOKED) la borraba la limpieza de reservas a los 10 minutos.
        const isFree = ticketType.category === 'FREE';
        const [ticketGroupCreated] = await tx
          .insert(ticketGroup)
          .values({
            eventId: input.eventId,
            status: isFree ? 'FREE' : input.paidOnLocation ? 'PAID' : 'BOOKED',
            paymentMethod: isFree ? null : 'ON_SITE',
            totalAmount: isFree ? '0' : (ticketType.price ?? 0).toFixed(2),
            amountTickets: 1,
            invitedById: input.invitedBy,
          })
          .returning();

        await tx.insert(ticketTypePerGroup).values({
          ticketTypeId: input.ticketTypeId,
          ticketGroupId: ticketGroupCreated.id,
          amount: 1,
        });

        const lastEmitted = await tx.query.emittedTicket.findFirst({
          where: eq(emittedTicket.ticketGroupId, ticketGroupCreated.id),
          orderBy: desc(emittedTicket.createdAt),
          with: {
            ticketType: {
              columns: {
                name: true,
              },
            },
          },
        });

        let slug = '';
        if (lastEmitted && lastEmitted.slug) {
          const parts = lastEmitted.slug.split('-');
          const count = parseInt(parts[parts.length - 1], 10);
          slug = generateSlug(`${lastEmitted.ticketType.name} ${count}`);
        } else {
          slug = generateSlug(`${ticketType?.name} 0`);
        }

        const [shortId] = await allocateEmittedTicketShortIds(
          tx,
          input.eventId,
          1,
        );

        const [ticketCreated] = await tx
          .insert(emittedTicket)
          .values({
            ...ticketInput,
            birthDate: dateToDateOnlyString(input.birthDate),
            ticketGroupId: ticketGroupCreated.id,
            slug,
            shortId: shortId!,
          })
          .returning();

        // Sólo si quien emite lo marca (venta en la puerta): si no, el QR que
        // se manda por mail nacía 'ya escaneado' y lo rechazaban al entrar.
        if (alreadyEntered) {
          await registerTicketScanInTx(
            tx,
            ticketCreated.id,
            ctx.session.user.id,
          );
        }

        return ticketCreated;
      });
      return ticketCreated;
    }),

  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.length === 0) return [];

      // Todas las entradas tienen que pertenecer al mismo ticketGroup: la emisión
      // se valida contra lo que ese grupo reservó, no contra lo que manda el form.
      const ticketGroupId = input[0].ticketGroupId;
      if (input.some((ticket) => ticket.ticketGroupId !== ticketGroupId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Las entradas deben pertenecer al mismo grupo',
        });
      }

      // Bloqueado después de reservar: la compra en curso no se completa.
      await assertTicketGroupEventNotBlocked(ctx.db, ticketGroupId);

      try {
        const uniqueTicketTypeIds = input.map((ticket) => ticket.ticketTypeId);

        // Fetch ticket type names and count existing tickets for each type in a single query
        const ticketTypeData = await ctx.db
          .select({
            ticketTypeId: ticketTypeTable.id,
            name: ticketTypeTable.name,
            existingCount: count(emittedTicket.id),
          })
          .from(ticketTypeTable)
          .leftJoin(
            emittedTicket,
            eq(ticketTypeTable.id, emittedTicket.ticketTypeId),
          )
          .where(inArray(ticketTypeTable.id, uniqueTicketTypeIds))
          .groupBy(ticketTypeTable.id, ticketTypeTable.name);

        const ticketTypes = new Map(
          ticketTypeData.map((data) => [data.ticketTypeId, data]),
        );

        // <TicketTypeId, Count>
        const newTicketCounts = new Map<string, number>();

        const res = await ctx.db.transaction(async (tx) => {
          // Lock del grupo: serializa dos envíos simultáneos del mismo checkout.
          const [group] = await tx
            .select({ id: ticketGroup.id })
            .from(ticketGroup)
            .where(eq(ticketGroup.id, ticketGroupId))
            .for('update');
          if (!group) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Grupo de entradas no encontrado',
            });
          }

          // Idempotencia: si el grupo ya emitió (reintento tras fallo de mail,
          // doble click), devolver lo existente en vez de duplicar. Sólo a
          // quien las emitió: otra persona con la misma reserva recibía las
          // entradas (nombre, DNI y QR) de la primera.
          const alreadyEmitted = await tx.query.emittedTicket.findMany({
            where: eq(emittedTicket.ticketGroupId, ticketGroupId),
          });
          if (alreadyEmitted.length > 0) {
            const sameHolder = alreadyEmitted.some(
              (ticket) => ticket.dni.trim() === input[0].dni.trim(),
            );
            if (!sameHolder) {
              throw new TRPCError({
                code: 'CONFLICT',
                message:
                  'Estas entradas ya se emitieron a nombre de otra persona. Si te pasaron un link de invitación, pedí uno propio.',
              });
            }
            return alreadyEmitted;
          }

          // Emitir exactamente lo reservado: tipo y cantidad salen del grupo,
          // no del input (si no, se paga 1 General y se emiten 6 VIP).
          const reserved = await tx
            .select({
              ticketTypeId: ticketTypePerGroup.ticketTypeId,
              amount: ticketTypePerGroup.amount,
            })
            .from(ticketTypePerGroup)
            .where(eq(ticketTypePerGroup.ticketGroupId, ticketGroupId));

          const reservedByType = new Map(
            reserved.map((row) => [row.ticketTypeId, row.amount]),
          );
          const requestedByType = new Map<string, number>();
          for (const ticket of input) {
            requestedByType.set(
              ticket.ticketTypeId,
              (requestedByType.get(ticket.ticketTypeId) ?? 0) + 1,
            );
          }
          const typesMatch =
            reservedByType.size === requestedByType.size &&
            [...requestedByType].every(
              ([typeId, amount]) => reservedByType.get(typeId) === amount,
            );
          if (!typesMatch) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Las entradas no coinciden con la reserva del grupo',
            });
          }

          const countByEventId = new Map<string, number>();
          for (const ticket of input) {
            const eventId = ticket.eventId ?? '';
            countByEventId.set(eventId, (countByEventId.get(eventId) ?? 0) + 1);
          }

          const shortIdQueues = new Map<string, number[]>();
          for (const [eventId, countForEvent] of countByEventId) {
            shortIdQueues.set(
              eventId,
              await allocateEmittedTicketShortIds(tx, eventId, countForEvent),
            );
          }

          const values = input.map((ticket) => {
            const ticketTypeData = ticketTypes.get(ticket.ticketTypeId);
            if (!ticketTypeData) {
              throw new Error(
                `TicketType con ID: ${ticket.ticketTypeId} no encontrado`,
              );
            }

            const currentNewCount =
              newTicketCounts.get(ticket.ticketTypeId) || 0;
            const nextNewCount = currentNewCount + 1;
            newTicketCounts.set(ticket.ticketTypeId, nextNewCount);

            const totalCount = ticketTypeData.existingCount + nextNewCount;
            const slug = generateSlug(`${ticketTypeData.name} ${totalCount}`);
            const eventId = ticket.eventId ?? '';
            const queue = shortIdQueues.get(eventId);
            const shortId = queue?.shift();
            if (shortId === undefined) {
              throw new Error(
                `No se pudo asignar shortId para eventId: ${eventId}`,
              );
            }

            return {
              ...ticket,
              birthDate: dateToDateOnlyString(ticket.birthDate),
              slug,
              eventId,
              shortId,
            };
          });

          const inserted = await tx
            .insert(emittedTicket)
            .values(values)
            .returning();

          if (!inserted) throw 'Error al crear ticket/s';

          // Si hay tickets creados, verificar si hay un ticketXorganizer asociado al ticketGroup
          // y actualizar su ticketId con el primer ticket creado (modo INVITATION)
          if (inserted.length > 0 && input.length > 0) {
            const firstTicketGroupId = input[0].ticketGroupId;

            // Buscar el ticketGroup para obtener el organizerId
            const group = await tx.query.ticketGroup.findFirst({
              where: eq(ticketGroup.id, firstTicketGroupId),
              columns: {
                invitedById: true,
              },
            });

            // Si el ticketGroup tiene un organizerId asociado, buscar el ticketXorganizer
            if (group?.invitedById) {
              const ticketXOrg = await tx.query.ticketXorganizer.findFirst({
                where: and(
                  eq(ticketXorganizer.ticketGroupId, firstTicketGroupId),
                  eq(ticketXorganizer.organizerId, group.invitedById),
                ),
              });

              // Si existe y no tiene ticketId asignado, actualizarlo con el primer ticket
              if (ticketXOrg && !ticketXOrg.ticketId) {
                await tx
                  .update(ticketXorganizer)
                  .set({ ticketId: inserted[0].id })
                  .where(
                    and(
                      eq(ticketXorganizer.ticketGroupId, firstTicketGroupId),
                      eq(ticketXorganizer.organizerId, group.invitedById),
                    ),
                  );
              }
            }
          }

          return inserted;
        });

        return res;
      } catch (error) {
        // Dejar pasar los rechazos de validación con su mensaje real.
        if (error instanceof TRPCError) throw error;
        throw new Error('Error al crear ticket/s', { cause: error });
      }
    }),
  getAllUniqueBuyer: permissionProcedure('database:read_all').query(
    async ({ ctx }) => {
      const data = await ctx.db
        .selectDistinctOn([emittedTicket.dni], {
          dni: emittedTicket.dni,
          fullName: emittedTicket.fullName,
          mail: emittedTicket.mail,
          gender: emittedTicket.gender,
          instagram: emittedTicket.instagram,
          birthDate: emittedTicket.birthDate,
          phoneNumber: emittedTicket.phoneNumber,
        })
        .from(emittedTicket)
        .orderBy(emittedTicket.dni, desc(emittedTicket.createdAt));

      const dnis = data.map((item) => item.dni);
      const buyerCodes = await getBuyersCodeByDni(ctx.db, dnis);

      const dataWithAge = data.map((buyer) => ({
        ...buyer,
        age: ageFromBirthDate(buyer.birthDate),
        buyerCode: buyerCodes.get(buyer.dni)?.toString() || '---',
      }));

      return dataWithAge;
    },
  ),
  getAllUniqueBuyerByOrganizer: permissionProcedure('database:read')
    .input(z.uuid())
    .query(async ({ input, ctx }) => {
      if (input !== ctx.session.user.id && !ctx.can('database:read_all')) {
        throw forbidden();
      }

      const data = await ctx.db
        .selectDistinctOn([emittedTicket.dni], {
          dni: emittedTicket.dni,
          fullName: emittedTicket.fullName,
          mail: emittedTicket.mail,
          gender: emittedTicket.gender,
          instagram: emittedTicket.instagram,
          birthDate: emittedTicket.birthDate,
          phoneNumber: emittedTicket.phoneNumber,
        })
        .from(emittedTicket)
        .leftJoin(ticketGroup, eq(emittedTicket.ticketGroupId, ticketGroup.id))
        .where(eq(ticketGroup.invitedById, input))
        .orderBy(emittedTicket.dni, desc(emittedTicket.createdAt));

      const dnis = data.map((item) => item.dni);
      const buyerCodes = await getBuyersCodeByDni(ctx.db, dnis);

      const dataWithAge = data.map((buyer) => ({
        ...buyer,
        age: ageFromBirthDate(buyer.birthDate),
        buyerCode: buyerCodes.get(buyer.dni)?.toString() || '---',
      }));

      return dataWithAge;
    }),
  getUniqueBuyer: permissionProcedure('database:read')
    .input(emittedTicketSchema.shape.dni)
    .query(async ({ input, ctx }) => {
      const buyer = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.dni, input),
        orderBy: desc(emittedTicket.createdAt),
        columns: {
          fullName: true,
          dni: true,
          birthDate: true,
          phoneNumber: true,
          instagram: true,
          gender: true,
          mail: true,
        },
      });

      const events = await ctx.db
        .selectDistinctOn([event.id], {
          // Event
          id: event.id,
          eventName: event.name,
          eventStartingDate: event.startingDate,

          // TicketGroup
          ticketGroupId: ticketGroup.id,

          // Location
          locationName: location.name,

          // Invited by
          invitedBy: user.fullName,
        })
        .from(emittedTicket)
        .leftJoin(ticketGroup, eq(emittedTicket.ticketGroupId, ticketGroup.id))
        .leftJoin(event, eq(ticketGroup.eventId, event.id))
        .leftJoin(location, eq(event.locationId, location.id))
        .leftJoin(user, eq(ticketGroup.invitedById, user.id))
        .where(
          and(eq(emittedTicket.dni, input), eq(emittedTicket.scanned, true)),
        );

      if (!buyer) {
        return null;
      }

      const buyerCode = await getBuyersCodeByDni(ctx.db, [buyer.dni]);

      const buyerWithAge = {
        ...buyer,
        age: ageFromBirthDate(buyer.birthDate),
        buyerCode: buyerCode.get(buyer.dni)?.toString() || '---',
      };

      return { buyer: buyerWithAge, events };
    }),
  getEmissionHistoryByDni: permissionProcedure('database:emission_history')
    .input(emittedTicketSchema.shape.dni)
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select({
          id: emittedTicket.id,
          createdAt: emittedTicket.createdAt,
          eventName: event.name,
          ticketTypeName: ticketTypeTable.name,
          scanned: emittedTicket.scanned,
        })
        .from(emittedTicket)
        .innerJoin(event, eq(emittedTicket.eventId, event.id))
        .innerJoin(
          ticketTypeTable,
          eq(emittedTicket.ticketTypeId, ticketTypeTable.id),
        )
        .where(eq(emittedTicket.dni, input))
        .orderBy(desc(emittedTicket.createdAt));
    }),
  getPdf: permissionProcedure('tickets:download')
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
        with: {
          ticketGroup: {
            with: {
              user: {
                columns: {
                  fullName: true,
                },
              },
              event: {
                with: {
                  location: true,
                },
              },
            },
          },
          ticketType: true,
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      const blob = await generatePdf(
        {
          eventName: ticket.ticketGroup.event.name,
          startingDate: ticket.ticketType.startingDate,
          eventStartingDate: ticket.ticketGroup.event.startingDate,
          eventLocation: ticket.ticketGroup.event.location?.address ?? '',
          ticketType: ticket.ticketType.name,
          createdAt: ticket.createdAt,
          dni: ticket.dni,
          fullName: ticket.fullName,
          id: ticket.id,
          invitedBy: ticket.ticketGroup.user?.fullName ?? '-',
          slug: ticket.slug,
          ticketSlugVisibleInPdf:
            ticket.ticketGroup.event.ticketSlugVisibleInPdf,
        },
        ctx.instance,
      );

      const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
      return { base64 };
    }),
  scan: permissionProcedure('scanner:use')
    .input(
      z.object({
        barcode: z.string(),
        eventIds: z.array(z.string()),
        /** 'Dejar pasar igual' fuera del horario de la entrada. */
        force: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const startedAt = performance.now();
      // Cada respuesta informa cuánto tardó el servidor, así el scanner puede
      // separar la demora de red de la del servidor.
      const respond = <
        T extends { status: string; ticket: { eventId: string } | null },
      >(
        result: T,
      ) => {
        const serverMs = Math.round(performance.now() - startedAt);
        logger.info('Ticket scan', {
          operation: 'ticket_scan',
          status: result.status,
          eventId: result.ticket?.eventId,
          serverMs,
        });
        return { ...result, serverMs };
      };

      let decryptedTicketId: string;
      try {
        decryptedTicketId = decryptString(input.barcode);
      } catch {
        return respond({
          ticket: null,
          status: 'not-found',
          text: 'Ticket no encontrado',
          extraInfo: 'El ticket no pertenece a este evento',
        });
      }

      const ticketReturned = await ctx.db.query.emittedTicket.findFirst({
        where: and(
          eq(emittedTicket.id, decryptedTicketId),
          inArray(emittedTicket.eventId, input.eventIds),
        ),
        with: {
          ticketType: true,
          emittedTicketScans: {
            columns: { id: true },
          },
          ticketGroup: {
            with: {
              event: true,
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!ticketReturned) {
        // Una entrada válida de otro evento y un QR cualquiera daban el mismo
        // cartel: la puerta no sabía si mandarla a otro lado o rechazarla.
        const elsewhere = await ctx.db.query.emittedTicket.findFirst({
          where: eq(emittedTicket.id, decryptedTicketId),
          columns: { id: true },
          with: {
            ticketGroup: { with: { event: { columns: { name: true } } } },
          },
        });
        return respond({
          ticket: null,
          status: 'not-found',
          text: elsewhere ? 'Entrada de otro evento' : 'Ticket no encontrado',
          extraInfo: elsewhere
            ? `Es para ${elsewhere.ticketGroup.event.name}`
            : 'No es una entrada de este evento o ya no existe',
        });
      }
      let extraInfo: string = '';
      const ticket = {
        ...ticketReturned,
        ticketGroup: {
          ...ticketReturned.ticketGroup,
          invitedBy: ticketReturned.ticketGroup.user?.fullName || '-',
        },
      };

      const now = new Date();
      const startsAt = ticket.ticketType.startingDate
        ? new Date(ticket.ticketType.startingDate)
        : null;
      const endsAt = ticket.ticketType.scanLimit
        ? new Date(ticket.ticketType.scanLimit)
        : null;
      const tooEarly = startsAt !== null && startsAt > now;
      const expired = endsAt !== null && endsAt < now;

      if (ticketReturned.scanned && !ticket.ticketType.allowMultipleScans) {
        return respond({
          ticket,
          status: 'already-scanned',
          text: 'Ticket ya escaneado',
          extraInfo: `Escaneado a las ${formatLastScanTime(ticket.scannedAt)}`,
        });
      }

      // Fuera de horario se avisa sin registrar: antes se marcaba el ingreso y
      // recién después se armaba el aviso, así que a la hora correcta ese QR
      // daba 'ya escaneado'. Quien está en la puerta puede dejarlo pasar igual.
      if ((tooEarly || expired) && !input.force) {
        return respond({
          ticket,
          status: tooEarly ? ('too-early' as const) : ('expired' as const),
          text: tooEarly ? 'Todavía no está habilitada' : 'Entrada vencida',
          extraInfo: tooEarly
            ? `Habilitada desde ${formatScanWindow(startsAt)}`
            : `Era válida hasta ${formatScanWindow(endsAt)}`,
        });
      }

      const scanResult = await tryRegisterTicketScan(
        ctx.db,
        decryptedTicketId,
        ctx.session.user.id,
        ticket.ticketType.allowMultipleScans,
      );
      if (!scanResult.registered) {
        return respond({
          ticket,
          status: 'already-scanned',
          text: 'Ticket ya escaneado',
          extraInfo: `Escaneado a las ${formatLastScanTime(ticket.scannedAt)}`,
        });
      }

      const scannedAt = scanResult.scannedAt;
      const scanNumber = ticket.emittedTicketScans.length + 1;

      ticket.scanned = true;
      ticket.scannedAt = scannedAt;
      ticket.scannedByUserId = ctx.session.user.id;

      if (tooEarly) {
        extraInfo = `Entró antes de hora (habilitada desde ${formatScanWindow(startsAt)})`;
      } else if (expired) {
        extraInfo = `Entró con la entrada vencida (válida hasta ${formatScanWindow(endsAt)})`;
      }

      return respond({
        ticket,
        status: 'success',
        text: `Escaneado con éxito: ${ticket.fullName}`,
        extraInfo:
          `${extraInfo}${scanNumber > 1 ? ` - Escaneo #${scanNumber}` : ''} ${ticket.ticketGroup.user?.fullName ? `- Invitado por ${ticket.ticketGroup.user.fullName}` : ''}`.trim(),
      });
    }),
  manualScan: permissionProcedure('tickets:manual_scan')
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
        with: {
          ticketType: true,
        },
      });
      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      const scanResult = await tryRegisterTicketScan(
        ctx.db,
        input.ticketId,
        ctx.session.user.id,
        ticket.ticketType.allowMultipleScans,
      );
      if (!scanResult.registered) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ticket ya escaneado',
        });
      }

      const updatedTicket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
      });

      return { success: true, ticket: updatedTicket };
    }),
  getByEventId: anyPermissionProcedure(['tickets:read', 'organizer:act'])
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let ticketGroupIds: string[] = [];
      let organizersEmittedTicketsIds: string[] = [];
      const canSeeAllTickets = ctx.can('tickets:read_all');

      if (!canSeeAllTickets && ctx.can('organizer:team')) {
        const organizers = await ctx.db.query.user.findMany({
          where: eq(user.chiefOrganizerId, ctx.session.user.id),
        });

        const organizerIds = [
          ctx.session.user.id,
          ...organizers.map((o) => o.id),
        ];

        // Ticket groups del evento cuyo invitedById es el jefe o uno de sus organizadores
        const groups = await ctx.db
          .select({ id: ticketGroup.id })
          .from(ticketGroup)
          .where(
            and(
              eq(ticketGroup.eventId, input.eventId),
              inArray(ticketGroup.invitedById, organizerIds),
            ),
          );
        ticketGroupIds = groups.map((g) => g.id);

        // Incluir también tickets de tipo "organizador" solo de los organizadores del chief
        const organizerTicketType = await ctx.db.query.ticketType.findFirst({
          where: and(
            eq(ticketTypeTable.eventId, input.eventId),
            eq(ticketTypeTable.name, ORGANIZER_TICKET_TYPE_NAME),
          ),
          columns: { id: true },
        });
        if (organizerTicketType) {
          const allOrganizersTickets =
            await ctx.db.query.emittedTicket.findMany({
              where: and(
                eq(emittedTicket.eventId, input.eventId),
                eq(emittedTicket.ticketTypeId, organizerTicketType.id),
              ),
            });

          // IDs de emittedTicket cuyo ticket organizador pertenece a un organizador del chief (por email)
          organizersEmittedTicketsIds = allOrganizersTickets
            .filter((t) => organizers.some((o) => o.email === t.mail))
            .map((t) => t.id);
        }
      } else if (!canSeeAllTickets) {
        const groups = await ctx.db.query.ticketGroup.findMany({
          where: and(
            eq(ticketGroup.eventId, input.eventId),
            eq(ticketGroup.invitedById, ctx.session.user.id),
          ),
          columns: {
            id: true,
          },
        });
        ticketGroupIds = groups.map((g) => g.id);
      }

      // Admin ve todo; resto: si no hay grupos ni IDs de tickets organizador, no hay tickets que traer
      const hasGroups = ticketGroupIds.length > 0;
      const hasOrganizerTickets = organizersEmittedTicketsIds.length > 0;
      if (!canSeeAllTickets && !hasGroups && !hasOrganizerTickets) {
        return [];
      }

      // Compras sin pagar (Mercado Pago, transferencia o sin medio de pago):
      // sus entradas ya existen pero no son ventas. Las de cobro en el lugar sí.
      const unpaidGroups = ctx.db
        .select({ id: ticketGroup.id })
        .from(ticketGroup)
        .where(
          and(
            eq(ticketGroup.eventId, input.eventId),
            eq(ticketGroup.status, 'BOOKED'),
            or(
              isNull(ticketGroup.paymentMethod),
              ne(ticketGroup.paymentMethod, 'ON_SITE'),
            ),
          ),
        );

      const tickets = await ctx.db.query.emittedTicket.findMany({
        where: canSeeAllTickets
          ? and(
              eq(emittedTicket.eventId, input.eventId),
              notInArray(emittedTicket.ticketGroupId, unpaidGroups),
            )
          : and(
              eq(emittedTicket.eventId, input.eventId),
              notInArray(emittedTicket.ticketGroupId, unpaidGroups),
              hasGroups && hasOrganizerTickets
                ? or(
                    inArray(emittedTicket.ticketGroupId, ticketGroupIds),
                    inArray(emittedTicket.id, organizersEmittedTicketsIds),
                  )
                : hasGroups
                  ? inArray(emittedTicket.ticketGroupId, ticketGroupIds)
                  : inArray(emittedTicket.id, organizersEmittedTicketsIds),
            ),
        with: {
          ticketType: true,
          emittedTicketScans: {
            orderBy: (scans, { desc }) => [desc(scans.scannedAt)],
            with: {
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
          ticketGroup: {
            with: {
              user: {
                columns: {
                  fullName: true,
                },
                with: {
                  user: {
                    columns: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const eventInvite = await ctx.db.query.event.findFirst({
        where: eq(event.id, input.eventId),
        columns: { inviteCondition: true },
      });
      const isInvitation = eventInvite?.inviteCondition === 'INVITATION';

      const ticketIds = tickets.map((t) => t.id);
      const invitationShortIdByTicketId = new Map<string, number>();
      if (isInvitation && ticketIds.length > 0) {
        const ticketXRows = await ctx.db.query.ticketXorganizer.findMany({
          where: and(
            eq(ticketXorganizer.eventId, input.eventId),
            inArray(ticketXorganizer.ticketId, ticketIds),
          ),
          columns: { ticketId: true, shortId: true },
        });
        for (const row of ticketXRows) {
          if (row.ticketId) {
            invitationShortIdByTicketId.set(row.ticketId, row.shortId);
          }
        }
      }

      const buyerCodes =
        !isInvitation && tickets.length > 0
          ? await getBuyersCodeByDni(
              ctx.db,
              tickets.map((ticket) => ticket.dni),
            )
          : null;

      return tickets.map((ticket) => ({
        ...ticket,
        buyerCode: isInvitation
          ? (invitationShortIdByTicketId.get(ticket.id)?.toString() ?? '-')
          : buyerCodes?.get(ticket.dni)?.toString() || '---',
        ticketGroup: {
          ...ticket.ticketGroup,
          invitedBy: ticket.ticketGroup.user?.fullName || '-',
        },
      }));
    }),
  send: permissionProcedure('tickets:resend')
    .input(
      z.object({
        ticketId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
        with: {
          ticketGroup: {
            with: {
              event: {
                with: {
                  location: true,
                },
              },
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
          ticketType: true,
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      const pdf = await generatePdf(
        {
          eventName: ticket.ticketGroup.event.name,
          startingDate: ticket.ticketType.startingDate,
          eventStartingDate: ticket.ticketGroup.event.startingDate,
          eventLocation: ticket.ticketGroup.event.location?.address ?? '',
          ticketType: ticket.ticketType.name,
          createdAt: ticket.createdAt,
          dni: ticket.dni,
          fullName: ticket.fullName,
          id: ticket.id,
          invitedBy: ticket.ticketGroup.user?.fullName ?? '-',
          slug: ticket.slug,
          ticketSlugVisibleInPdf:
            ticket.ticketGroup.event.ticketSlugVisibleInPdf,
        },
        ctx.instance,
      );

      const { data, error } = await sendMail(ctx.instance, {
        to: ticket.mail,
        subject: `Ticket de ${ticket.ticketGroup.event.name}`,
        body: `Hola ${ticket.fullName}, te enviamos tu ticket de ${ticket.ticketGroup.event.name}`,
        attachments: [Buffer.from(await pdf.arrayBuffer())],
        eventName: ticket.ticketGroup.event.name,
      });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al enviar el correo',
        });
      }

      return { success: true, data };
    }),

  delete: permissionProcedure('tickets:delete')
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(emittedTicket)
        .where(eq(emittedTicket.id, input.ticketId));
    }),
});
