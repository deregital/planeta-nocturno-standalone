import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  emittedTicket,
  event as eventTable,
  eventQuestion,
  ticketGroup,
  ticketGroupAnswer,
  ticketTypePerGroup,
  ticketType as ticketTypeTable,
  ticketXorganizer,
} from '@/drizzle/schema';
import { capturePurchaseCompleted } from '@/server/analytics/purchase-events';
import { logger } from '@/server/observability/logger';
import { invitedBySchema } from '@/server/schemas/emitted-tickets';
import { getTransferAlias } from '@/server/services/paymentSettings';
import {
  deliverPaidTicketGroup,
  generateTicketGroupPdfs,
} from '@/server/services/ticketGroup';
import {
  CHECKOUT_HOLD_TTL_MS,
  eventHoldCondition,
  MERCADO_PAGO_HOLD_TTL_MS,
  releaseExpiredHolds,
} from '@/server/services/ticketGroupHolds';
import { permissionProcedure, publicProcedure, router } from '@/server/trpc';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { generatePdf } from '@/server/utils/ticket-template';

function ticketGroupNotFound() {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: 'ticketGroup no encontrado',
  });
}

/** Hasta cuándo retiene el cupo una reserva sin pagar, para avisarle al comprador. */
function holdExpiresAt(group: {
  status: string;
  paymentMethod: string | null;
  createdAt: string;
}) {
  if (group.status !== 'BOOKED') return null;
  const ttl =
    group.paymentMethod === null
      ? CHECKOUT_HOLD_TTL_MS
      : group.paymentMethod === 'MERCADO_PAGO'
        ? MERCADO_PAGO_HOLD_TTL_MS
        : null;
  if (ttl === null) return null;
  return new Date(new Date(group.createdAt).getTime() + ttl).toISOString();
}

export const ticketGroupSchema = z.object({
  id: z.uuid(), // uuid generado por defaultRandom()
  status: z.enum(['BOOKED', 'FREE', 'PAID']), // asumido según tu enum
  amountTickets: z.number().int().min(0), // default 0 en DB
  eventId: z.uuid(), // FK
  createdAt: z.iso.datetime({ offset: true }), // timestamp con zona horaria en formato string
});

export const ticketGroupRouter = router({
  create: publicProcedure
    .input(
      z.object({
        eventId: ticketGroupSchema.shape.eventId,
        ticketsPerType: z
          .object({
            ticketTypeId: z.string(),
            amount: z.number().int().min(0),
          })
          .array(),
        invitedBy: invitedBySchema,
        /** Reserva anterior del mismo navegador (cookie 'carrito'): se suelta. */
        previousTicketGroupId: z.uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ticketsPerType.every((ticket) => ticket.amount <= 0)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se han seleccionado tickets para comprar',
        });
      }

      const requested = input.ticketsPerType.filter(
        (ticket) => ticket.amount > 0,
      );
      const requestedTypeIds = requested.map((ticket) => ticket.ticketTypeId);

      const result = await ctx.db.transaction(async (tx) => {
        // Volver a tocar CONTINUAR (o Atrás y elegir de nuevo) dejaba la
        // reserva anterior tomando cupo hasta que vencía.
        if (input.previousTicketGroupId) {
          await tx
            .delete(ticketGroup)
            .where(
              and(
                eq(ticketGroup.id, input.previousTicketGroupId),
                eq(ticketGroup.status, 'BOOKED'),
                isNull(ticketGroup.paymentMethod),
              ),
            );
        }

        // Un evento desactivado o terminado no se vende aunque se tenga el link.
        const [eventRow] = await tx
          .select({
            isActive: eventTable.isActive,
            isDeleted: eventTable.isDeleted,
            inviteCondition: eventTable.inviteCondition,
            endingDate: eventTable.endingDate,
          })
          .from(eventTable)
          .where(eq(eventTable.id, input.eventId));
        if (
          !eventRow ||
          eventRow.isDeleted ||
          (!eventRow.isActive && eventRow.inviteCondition !== 'INVITATION')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Este evento no está a la venta',
          });
        }
        if (eventRow.endingDate && new Date(eventRow.endingDate) < new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El evento ya terminó',
          });
        }

        // El stock sólo se controlaba en el navegador. Validar en el servidor,
        // con los tipos de entrada bloqueados para serializar compras simultáneas
        // del mismo tipo y que dos no superen juntas el cupo.
        await releaseExpiredHolds(tx, eventHoldCondition(input.eventId));

        const types = await tx
          .select({
            id: ticketTypeTable.id,
            name: ticketTypeTable.name,
            maxAvailable: ticketTypeTable.maxAvailable,
            maxPerPurchase: ticketTypeTable.maxPerPurchase,
            maxSellDate: ticketTypeTable.maxSellDate,
          })
          .from(ticketTypeTable)
          .where(
            and(
              inArray(ticketTypeTable.id, requestedTypeIds),
              eq(ticketTypeTable.eventId, input.eventId),
            ),
          )
          .orderBy(ticketTypeTable.id)
          .for('update');
        const typeById = new Map(types.map((type) => [type.id, type]));

        const takenRows = await tx
          .select({
            ticketTypeId: ticketTypePerGroup.ticketTypeId,
            taken: sql<number>`coalesce(sum(${ticketTypePerGroup.amount}), 0)::int`,
          })
          .from(ticketTypePerGroup)
          .innerJoin(
            ticketGroup,
            eq(ticketTypePerGroup.ticketGroupId, ticketGroup.id),
          )
          .where(
            and(
              eq(ticketGroup.eventId, input.eventId),
              inArray(ticketTypePerGroup.ticketTypeId, requestedTypeIds),
            ),
          )
          .groupBy(ticketTypePerGroup.ticketTypeId);
        const takenByType = new Map(
          takenRows.map((row) => [row.ticketTypeId, row.taken]),
        );

        const now = new Date();
        for (const line of requested) {
          const type = typeById.get(line.ticketTypeId);
          if (!type) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Tipo de entrada inválido para este evento',
            });
          }
          if (type.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim()) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Ese tipo de entrada no está a la venta',
            });
          }
          if (type.maxSellDate && new Date(type.maxSellDate) < now) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `La venta de ${type.name} ya cerró`,
            });
          }
          if (line.amount > type.maxPerPurchase) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `No se pueden comprar más de ${type.maxPerPurchase} entradas de ${type.name} por compra`,
            });
          }
          // El agregado puede volver como texto: "10" + 1 arma "101" y el cupo parece agotado.
          const taken = Number(takenByType.get(line.ticketTypeId) ?? 0);
          if (taken + line.amount > type.maxAvailable) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `No hay suficientes entradas de ${type.name} disponibles`,
            });
          }
        }

        // Si hay un invitedBy explícito, usarlo
        const invitedById = input.invitedBy ?? null;

        const ticketGroupData = {
          eventId: input.eventId,
          status: 'BOOKED' as const,
          amountTickets: input.ticketsPerType.reduce(
            (sum, ticket) => sum + ticket.amount,
            0,
          ),
          invitedById,
        };

        const result = await tx
          .insert(ticketGroup)
          .values(ticketGroupData)
          .returning();

        if (!result) {
          tx.rollback();
          throw new Error('No se pudo crear el grupo de tickets');
        }

        const ticketGroupId = result[0].id;

        // Insertar las relaciones con los tipos de tickets
        const ticketTypePerGroups = input.ticketsPerType
          .map((ticket) => ({
            ticketGroupId,
            ticketTypeId: ticket.ticketTypeId,
            amount: ticket.amount,
          }))
          .filter((ticketType) => ticketType.amount > 0);

        await tx.insert(ticketTypePerGroup).values(ticketTypePerGroups);

        return ticketGroupId;
      });

      if (!result) throw 'Error al crear ticketGroup';
      return result;
    }),
  /**
   * Canje de un código de invitación. El cupo real es el código, no
   * maxAvailable: cada apertura del link creaba una reserva nueva y el
   * código seguía libre, así que el control de stock lo rechazaba aunque
   * quedaran invitaciones. Si ya hay una reserva abierta para ese código, la
   * reutiliza el mismo navegador; otro navegador la toma (la anterior se
   * suelta), así dos personas con el mismo link nunca comparten una reserva.
   */
  redeemInvitation: publicProcedure
    .input(
      z.object({
        eventId: z.uuid(),
        code: z
          .string()
          .trim()
          .regex(
            /^[0-9A-Fa-f]{6}$/,
            'El código debe ser de 6 dígitos hexadecimales',
          ),
        /** Reserva del navegador que abre el link (cookie 'carrito'). */
        currentTicketGroupId: z.uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const code = input.code.toUpperCase();

      return ctx.db.transaction(async (tx) => {
        await releaseExpiredHolds(tx, eventHoldCondition(input.eventId));

        const [invite] = await tx
          .select({
            organizerId: ticketXorganizer.organizerId,
            ticketId: ticketXorganizer.ticketId,
            ticketGroupId: ticketXorganizer.ticketGroupId,
          })
          .from(ticketXorganizer)
          .where(
            and(
              eq(ticketXorganizer.eventId, input.eventId),
              eq(ticketXorganizer.code, code),
            ),
          )
          .for('update');

        if (!invite) return { status: 'invalid_code' as const };
        if (invite.ticketId) return { status: 'already_used' as const };

        if (invite.ticketGroupId) {
          const [existing] = await tx
            .select({
              id: ticketGroup.id,
              status: ticketGroup.status,
              paymentMethod: ticketGroup.paymentMethod,
            })
            .from(ticketGroup)
            .where(eq(ticketGroup.id, invite.ticketGroupId));

          // Reserva del checkout en curso. El grupo compartido del organizador
          // queda en FREE y no tiene ticketTypePerGroup: ese no se reutiliza.
          if (existing?.status === 'BOOKED') {
            if (existing.id === input.currentTicketGroupId) {
              return {
                status: 'ok' as const,
                ticketGroupId: existing.id,
                organizerId: invite.organizerId,
              };
            }
            // Una reserva que ya está en un pago no se le saca a quien paga.
            if (existing.paymentMethod) {
              return { status: 'already_used' as const };
            }
            // Otro navegador (la misma persona en otro dispositivo, o alguien
            // a quien le reenviaron el link): se suelta la reserva anterior y
            // se crea una propia. El checkout viejo ya no puede completarse.
            await tx.delete(ticketGroup).where(eq(ticketGroup.id, existing.id));
          } else if (existing) {
            const [hold] = await tx
              .select({
                ticketGroupId: ticketTypePerGroup.ticketGroupId,
              })
              .from(ticketTypePerGroup)
              .where(eq(ticketTypePerGroup.ticketGroupId, existing.id))
              .limit(1);
            if (hold) return { status: 'already_used' as const };
          }
        }

        const types = await tx
          .select({
            id: ticketTypeTable.id,
            name: ticketTypeTable.name,
            maxSellDate: ticketTypeTable.maxSellDate,
          })
          .from(ticketTypeTable)
          .where(eq(ticketTypeTable.eventId, input.eventId));
        const publicTypes = types.filter(
          (type) => type.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
        );
        if (publicTypes.length !== 1) {
          return { status: 'invalid_configuration' as const };
        }

        const ticketType = publicTypes[0];
        if (
          ticketType.maxSellDate &&
          new Date(ticketType.maxSellDate) < new Date()
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `La venta de ${ticketType.name} ya cerró`,
          });
        }

        const [created] = await tx
          .insert(ticketGroup)
          .values({
            eventId: input.eventId,
            status: 'BOOKED',
            amountTickets: 1,
            invitedById: invite.organizerId,
          })
          .returning({ id: ticketGroup.id });

        await tx.insert(ticketTypePerGroup).values({
          ticketGroupId: created.id,
          ticketTypeId: ticketType.id,
          amount: 1,
        });

        await tx
          .update(ticketXorganizer)
          .set({ ticketGroupId: created.id })
          .where(
            and(
              eq(ticketXorganizer.eventId, input.eventId),
              eq(ticketXorganizer.code, code),
            ),
          );

        return {
          status: 'ok' as const,
          ticketGroupId: created.id,
          organizerId: invite.organizerId,
        };
      });
    }),
  getById: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        columns: {
          id: true,
          status: true,
          amountTickets: true,
          eventId: true,
          createdAt: true,
          invitedById: true,
          isOrganizerGroup: true,
          paymentMethod: true,
        },
        with: {
          user: {
            columns: {
              id: true,
              fullName: true,
              code: true,
            },
          },
          ticketTypePerGroups: {
            with: {
              ticketType: {
                columns: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  category: true,
                },
              },
            },
          },
          event: {
            columns: {
              id: true,
              name: true,
              description: true,
              startingDate: true,
              endingDate: true,
              coverImageUrl: true,
              inviteCondition: true,
              extraTicketData: true,
              emailNotification: true,
              serviceFee: true,
              hasSimpleInvitation: true,
            },
            with: {
              location: {
                columns: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
              eventCategory: {
                columns: {
                  id: true,
                  name: true,
                },
              },
              eventQuestions: {
                where: eq(eventQuestion.isDeleted, false),
                orderBy: [
                  asc(eventQuestion.sortOrder),
                  asc(eventQuestion.createdAt),
                ],
              },
            },
          },
        },
      });

      if (!group) {
        throw ticketGroupNotFound();
      }

      return {
        ...group,
        invitedBy: group.user?.fullName ?? '',
        organizerCode: group.user?.code ?? null,
        organizerId: group.invitedById ?? null,
        holdExpiresAt: holdExpiresAt(group),
      };
    }),
  getTicketTypePerGroupById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.ticketTypePerGroup.findMany({
        where: eq(ticketTypePerGroup.ticketGroupId, input),
      });
      return groups;
    }),
  /** Entradas tomadas por tipo (incluye reservas sin pagar), sumadas en la base. */
  getTicketTypeAmounts: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          ticketTypeId: ticketTypePerGroup.ticketTypeId,
          amount: sql<number>`sum(${ticketTypePerGroup.amount})::int`,
        })
        .from(ticketTypePerGroup)
        .innerJoin(
          ticketGroup,
          eq(ticketTypePerGroup.ticketGroupId, ticketGroup.id),
        )
        .where(eq(ticketGroup.eventId, input))
        .groupBy(ticketTypePerGroup.ticketTypeId);
    }),
  findById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const group = await ctx.db.query.ticketGroup.findFirst({
      where: eq(ticketGroup.id, input),
    });

    if (!group) {
      throw ticketGroupNotFound();
    }

    return group;
  }),
  updateInvitedBy: publicProcedure
    .input(z.object({ id: ticketGroupSchema.shape.id, invitedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db
        .update(ticketGroup)
        .set({ invitedById: input.invitedBy || null })
        .where(eq(ticketGroup.id, input.id))
        .returning();

      return group[0];
    }),
  updateInvitedBySimple: publicProcedure
    .input(
      z.object({ id: ticketGroupSchema.shape.id, invitedBySimple: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db
        .update(ticketGroup)
        .set({ invitedBySimple: input.invitedBySimple })
        .where(eq(ticketGroup.id, input.id))
        .returning();
      return group[0];
    }),
  saveAnswers: publicProcedure
    .input(
      z.object({
        ticketGroupId: z.uuid(),
        answers: z.array(
          z.object({
            questionId: z.uuid(),
            answer: z.string().trim().min(1, 'La respuesta es requerida'),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.answers.length === 0) {
        return [];
      }

      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input.ticketGroupId),
        columns: {
          id: true,
          eventId: true,
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tickets no encontrados',
        });
      }

      const eventQuestions = await ctx.db.query.eventQuestion.findMany({
        where: eq(eventQuestion.eventId, group.eventId),
        columns: {
          id: true,
        },
      });

      const validQuestionIds = new Set(eventQuestions.map((q) => q.id));

      for (const answer of input.answers) {
        if (!validQuestionIds.has(answer.questionId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pregunta inválida para este evento',
          });
        }
      }

      return ctx.db
        .insert(ticketGroupAnswer)
        .values(
          input.answers.map((answer) => ({
            questionId: answer.questionId,
            ticketGroupId: input.ticketGroupId,
            answer: answer.answer,
          })),
        )
        .returning();
    }),
  updateTicketXOrganizerTicketGroupId: publicProcedure
    .input(
      z.object({
        code: z.string(),
        eventId: z.string().uuid(),
        ticketGroupId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(ticketXorganizer)
        .set({ ticketGroupId: input.ticketGroupId })
        .where(
          and(
            eq(ticketXorganizer.code, input.code.toUpperCase()),
            eq(ticketXorganizer.eventId, input.eventId),
          ),
        )
        .returning();

      return result[0];
    }),
  updateTicketXOrganizerTicketId: publicProcedure
    .input(
      z.object({
        ticketGroupId: z.string().uuid(),
        organizerId: z.string().uuid(),
        ticketId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(ticketXorganizer)
        .set({ ticketId: input.ticketId })
        .where(
          and(
            eq(ticketXorganizer.ticketGroupId, input.ticketGroupId),
            eq(ticketXorganizer.organizerId, input.organizerId),
          ),
        )
        .returning();

      return result[0];
    }),
  delete: permissionProcedure('tickets:delete')
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(ticketGroup)
        .where(eq(ticketGroup.id, input))
        .returning();

      if (result.length === 0) {
        throw new Error('Ticket group no encontrado');
      }

      return result[0];
    }),
  getTotalPriceById: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        with: {
          ticketTypePerGroups: {
            with: {
              ticketType: {
                columns: {
                  price: true,
                },
              },
            },
            columns: {
              amount: true,
            },
          },
        },
      });

      if (!group) {
        throw ticketGroupNotFound();
      }

      const totalPrice = group.ticketTypePerGroups.reduce(
        (total, ticketType) => {
          return total + ticketType.amount * (ticketType.ticketType.price ?? 0);
        },
        0,
      );

      return totalPrice;
    }),
  getTicketsForDownloadPage: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        columns: { id: true, status: true },
        with: {
          emittedTickets: {
            columns: { id: true, slug: true },
          },
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'TicketGroup no encontrado',
        });
      }

      // Verificar que este paid/free
      if (group.status === 'BOOKED') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'El ticketGroup no está concretado',
        });
      }

      // Verificar que hay tickets emitidos
      if (!group.emittedTickets?.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No hay tickets emitidos',
        });
      }

      return {
        ticketGroupId: group.id,
        tickets: group.emittedTickets.map((t) => ({ id: t.id, slug: t.slug })),
      };
    }),
  getPdfByEmittedTicketId: publicProcedure
    .input(
      z.object({
        ticketGroupId: ticketGroupSchema.shape.id,
        emittedTicketId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: and(
          eq(emittedTicket.id, input.emittedTicketId),
          eq(emittedTicket.ticketGroupId, input.ticketGroupId),
        ),
        columns: {
          id: true,
          fullName: true,
          dni: true,
          slug: true,
          createdAt: true,
        },
        with: {
          ticketType: { columns: { name: true, startingDate: true } },
          ticketGroup: {
            columns: { id: true, status: true },
            with: {
              user: { columns: { fullName: true } },
              event: {
                columns: {
                  name: true,
                  startingDate: true,
                  ticketSlugVisibleInPdf: true,
                },
                with: { location: { columns: { address: true } } },
              },
            },
          },
        },
      });

      if (!ticket?.ticketGroup?.event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      // Sin pago confirmado no hay PDF público (ni QR escaneable). El staff
      // logueado (p. ej. emisión manual desde admin) sí puede generarlo.
      if (ticket.ticketGroup.status === 'BOOKED' && !(await ctx.getAccess())) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'El grupo de entradas no está pago',
        });
      }

      const blob = await generatePdf(
        {
          eventName: ticket.ticketGroup.event.name,
          startingDate: ticket.ticketType.startingDate,
          eventStartingDate: ticket.ticketGroup.event.startingDate,
          eventLocation: ticket.ticketGroup.event.location?.address ?? '',
          createdAt: ticket.createdAt,
          dni: ticket.dni,
          fullName: ticket.fullName,
          id: ticket.id,
          ticketType: ticket.ticketType.name,
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
  generatePdfsByTicketGroupId: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      // Sin pago confirmado no hay PDF público; el staff logueado (emisión
      // manual desde admin) sí puede generarlo aunque el grupo siga BOOKED.
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        columns: { status: true },
      });
      if (group?.status === 'BOOKED' && !(await ctx.getAccess())) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'El grupo de entradas no está pago',
        });
      }
      return generateTicketGroupPdfs(ctx.db, ctx.instance, input);
    }),
  /** Lo que necesita la pantalla de espera del pago: volver al evento o a pagar. */
  getPendingPaymentInfo: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        columns: { status: true, paymentMethod: true, createdAt: true },
        with: {
          event: { columns: { slug: true } },
          ticketTypePerGroups: { columns: { amount: true }, limit: 1 },
        },
      });
      if (!group) return null;

      const holdsQuota = group.ticketTypePerGroups.length > 0;
      return {
        eventSlug: group.event.slug,
        holdExpiresAt: holdsQuota ? holdExpiresAt(group) : null,
        canRetryPayment:
          group.status === 'BOOKED' &&
          group.paymentMethod === 'MERCADO_PAGO' &&
          holdsQuota,
      };
    }),
  getTransferInstructions: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: and(
          eq(ticketGroup.id, input),
          eq(ticketGroup.status, 'BOOKED'),
          eq(ticketGroup.paymentMethod, 'TRANSFER'),
        ),
        columns: { id: true, totalAmount: true },
        with: {
          event: { columns: { name: true } },
          emittedTickets: { columns: { fullName: true }, limit: 1 },
        },
      });
      if (!group) return null;

      return {
        eventName: group.event.name,
        buyerName: group.emittedTickets[0]?.fullName ?? '',
        totalAmount: Number(group.totalAmount),
        transferAlias: await getTransferAlias(ctx.db),
        contactEmail: ctx.instance.contactEmail,
      };
    }),
  getPurchasesByEvent: permissionProcedure('tickets:read_all')
    .input(z.uuid())
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.ticketGroup.findMany({
        where: and(
          eq(ticketGroup.eventId, input),
          eq(ticketGroup.isOrganizerGroup, false),
        ),
        orderBy: [desc(ticketGroup.createdAt)],
        columns: {
          id: true,
          status: true,
          paymentMethod: true,
          totalAmount: true,
          amountTickets: true,
          createdAt: true,
        },
        with: {
          user: { columns: { fullName: true } },
          ticketTypePerGroups: {
            columns: { amount: true },
            with: { ticketType: { columns: { name: true } } },
          },
          emittedTickets: {
            columns: { id: true, fullName: true, dni: true, mail: true },
          },
        },
      });
    }),
  releaseTransfer: permissionProcedure('tickets:release')
    .input(ticketGroupSchema.shape.id)
    .mutation(async ({ ctx, input }) => {
      const [released] = await ctx.db
        .update(ticketGroup)
        .set({ status: 'PAID' })
        .where(
          and(
            eq(ticketGroup.id, input),
            eq(ticketGroup.status, 'BOOKED'),
            eq(ticketGroup.paymentMethod, 'TRANSFER'),
          ),
        )
        .returning({ id: ticketGroup.id });

      if (!released) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'La compra no existe o ya no está pendiente de transferencia',
        });
      }

      // Sin comprador: el request es del admin que libera la transferencia.
      await capturePurchaseCompleted(ctx.db, ctx.instance, {
        ticketGroupId: input,
        paymentMethod: 'transfer',
      });

      try {
        await deliverPaidTicketGroup(ctx.db, ctx.instance, input);
      } catch (error) {
        logger.error('Transfer release delivery failed', {
          ticketGroupId: input,
          error,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'La compra quedó como pagada pero no se pudieron enviar las entradas. Reenvialas desde la lista de ventas',
        });
      }
    }),
  cancelTransfer: permissionProcedure('tickets:release')
    .input(ticketGroupSchema.shape.id)
    .mutation(async ({ ctx, input }) => {
      const [cancelled] = await ctx.db
        .delete(ticketGroup)
        .where(
          and(
            eq(ticketGroup.id, input),
            eq(ticketGroup.status, 'BOOKED'),
            eq(ticketGroup.paymentMethod, 'TRANSFER'),
          ),
        )
        .returning({ id: ticketGroup.id });

      if (!cancelled) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'La compra no existe o ya no está pendiente de transferencia',
        });
      }
    }),
});
