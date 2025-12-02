import { type Font } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { barcodes, line, table, text } from '@pdfme/schemas';
import { TRPCError } from '@trpc/server';
import { isAfter, isBefore } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  lt,
  not,
} from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';
import z from 'zod';

import {
  emittedTicket,
  eventFolder,
  event as eventSchema,
  eventXorganizer,
  eventXUser,
  location as locationSchema,
  ticketGroup,
  ticketType,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { genderTranslation } from '@/lib/translations';
import {
  createEventSchema,
  eventSchema as eventSchemaZod,
} from '@/server/schemas/event';
import { organizerSchema } from '@/server/schemas/organizer';
import {
  createTicketTypeSchema,
  ticketTypeSchema,
} from '@/server/schemas/ticket-type';
import { sendMail } from '@/server/services/mail';
import {
  adminProcedure,
  publicProcedure,
  router,
  ticketingProcedure,
} from '@/server/trpc';
import { type TicketType } from '@/server/types';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import {
  type PDFDataGroupedTicketType,
  type PDFDataOrderName,
  presentismoPDFSchema,
  presentismoPDFSchemaGroupedTicketType,
} from '@/server/utils/presentismo-pdf';
import { generatePdf } from '@/server/utils/ticket-template';
import { generateSlug, getDMSansFonts } from '@/server/utils/utils';

export const eventsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const eventsWithFolders = await ctx.db.query.eventFolder.findMany({
      with: {
        events: {
          where: eq(eventSchema.isDeleted, false),
          with: {
            ticketTypes: true,
            location: {
              columns: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
          orderBy: desc(eventSchema.endingDate),
        },
      },
      orderBy: desc(eventFolder.name),
    });

    const eventsWithoutFolders = await ctx.db.query.event.findMany({
      where: and(
        eq(eventSchema.isDeleted, false),
        isNull(eventSchema.folderId),
      ),
      with: {
        ticketTypes: true,
        location: {
          columns: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: desc(eventSchema.endingDate),
    });

    const pastEvents = {
      folders: eventsWithFolders.map((folder) => {
        return {
          id: folder.id,
          name: folder.name,
          color: folder.color,
          events: folder.events.filter((event) =>
            isBefore(event.endingDate, new Date()),
          ),
        };
      }),
      withoutFolders: eventsWithoutFolders.filter((event) =>
        isBefore(event.endingDate, new Date()),
      ),
    };

    const upcomingEvents = {
      folders: eventsWithFolders.map((folder) => {
        return {
          id: folder.id,
          name: folder.name,
          color: folder.color,
          events: folder.events.filter((event) =>
            isAfter(event.endingDate, new Date()),
          ),
        };
      }),
      withoutFolders: eventsWithoutFolders.filter((event) =>
        isAfter(event.endingDate, new Date()),
      ),
    };

    return { pastEvents, upcomingEvents };
  }),
  getAuthorized: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userFound = await ctx.db.query.user.findFirst({
        where: eq(user.id, input),
        with: {
          eventXUsers: {
            with: {
              event: true,
            },
          },
        },
      });

      if (!userFound) throw 'Usuario no encontrado';

      const eventIds = userFound.eventXUsers.map((event) => event.event.id);

      const eventsWithFolders = await ctx.db.query.eventFolder.findMany({
        with: {
          events: {
            where: and(
              eq(eventSchema.isDeleted, false),
              inArray(eventSchema.id, eventIds),
            ),
            with: {
              ticketTypes: true,
              location: {
                columns: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
            },
            orderBy: desc(eventSchema.endingDate),
          },
        },
        orderBy: desc(eventFolder.name),
      });

      const eventsWithoutFolders = await ctx.db.query.event.findMany({
        where: and(
          eq(eventSchema.isDeleted, false),
          isNull(eventSchema.folderId),
          inArray(eventSchema.id, eventIds),
        ),
        with: {
          ticketTypes: true,
          location: {
            columns: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
        orderBy: desc(eventSchema.endingDate),
      });

      const pastEvents = {
        folders: eventsWithFolders.map((folder) => {
          return {
            id: folder.id,
            name: folder.name,
            color: folder.color,
            events: folder.events.filter((event) =>
              isBefore(event.endingDate, new Date()),
            ),
          };
        }),
        withoutFolders: eventsWithoutFolders.filter((event) =>
          isBefore(event.endingDate, new Date()),
        ),
      };

      const upcomingEvents = {
        folders: eventsWithFolders.map((folder) => {
          return {
            id: folder.id,
            name: folder.name,
            color: folder.color,
            events: folder.events.filter((event) =>
              isAfter(event.endingDate, new Date()),
            ),
          };
        }),
        withoutFolders: eventsWithoutFolders.filter((event) =>
          isAfter(event.endingDate, new Date()),
        ),
      };

      return { pastEvents, upcomingEvents };

      return { pastEvents, upcomingEvents };
    }),
  getActive: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.event.findMany({
      where: and(
        eq(eventSchema.isActive, true),
        eq(eventSchema.isDeleted, false),
        gt(eventSchema.endingDate, new Date().toISOString()),
      ),
      with: {
        ticketTypes: true,
        location: {
          columns: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
  }),
  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const data = await ctx.db.query.event.findFirst({
      where: and(eq(eventSchema.id, input), eq(eventSchema.isDeleted, false)),
      with: {
        ticketTypes: {
          columns: {
            id: true,
            description: true,
            maxPerPurchase: true,
            maxAvailable: true,
            name: true,
            price: true,
          },
        },
        location: {
          columns: {
            address: true,
          },
        },
      },
    });

    if (!data) throw 'Evento no encontrado'; // Otra forma manejar errores?

    return data;
  }),
  getBySlug: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const event = await ctx.db.query.event.findFirst({
      where: and(eq(eventSchema.slug, input), eq(eventSchema.isDeleted, false)),
      with: {
        ticketGroups: {
          with: {
            emittedTickets: {
              with: {
                ticketType: true,
              },
            },
          },
        },
        ticketTypes: true,
        location: {
          columns: {
            id: true,
            address: true,
            name: true,
          },
        },
        eventCategory: {
          columns: {
            id: true,
            name: true,
          },
        },
        eventXUsers: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        eventXorganizers: {
          columns: {
            discountPercentage: true,
            ticketAmount: true,
          },
          with: {
            user: {
              columns: {
                dni: true,
                id: true,
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    if (!event) return null;

    await ctx.db
      .delete(ticketGroup)
      .where(
        and(
          eq(ticketGroup.status, 'BOOKED'),
          eq(ticketGroup.eventId, event.id),
          lt(
            ticketGroup.createdAt,
            new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          ),
        ),
      );

    return event;
  }),
  validateOrganizerCode: publicProcedure
    .input(
      z.object({
        eventId: z.uuid(),
        code: z
          .string()
          .regex(
            /^[0-9A-Fa-f]{6}$/,
            'El código debe ser de 6 dígitos hexadecimales',
          ),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Buscar directamente eventXOrganizer usando el código del usuario y el eventId con join
      const result = await ctx.db
        .select({
          organizerId: eventXorganizer.organizerId,
          discountPercentage: eventXorganizer.discountPercentage,
          fullName: user.fullName,
        })
        .from(eventXorganizer)
        .innerJoin(user, eq(eventXorganizer.organizerId, user.id))
        .where(
          and(
            eq(eventXorganizer.eventId, input.eventId),
            eq(user.code, input.code.toUpperCase()),
          ),
        )
        .limit(1);

      if (!result.length) {
        return {
          valid: false,
          organizerName: null,
          organizerId: null,
          discountPercentage: null,
        };
      }

      const eventOrganizer = result[0];

      return {
        valid: true,
        organizerName: eventOrganizer.fullName,
        organizerId: eventOrganizer.organizerId,
        discountPercentage: eventOrganizer.discountPercentage,
      };
    }),
  validateInvitationCode: publicProcedure
    .input(
      z.object({
        eventId: z.uuid(),
        code: z
          .string()
          .regex(
            /^[0-9A-Fa-f]{6}$/,
            'El código debe ser de 6 dígitos hexadecimales',
          ),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Buscar ticketXorganizer usando el código y el eventId
      const result = await ctx.db.query.ticketXorganizer.findFirst({
        where: and(
          eq(ticketXorganizer.eventId, input.eventId),
          eq(ticketXorganizer.code, input.code.toUpperCase()),
        ),
      });

      if (!result) {
        return {
          valid: false,
          organizerId: null,
          alreadyUsed: false,
        };
      }

      // Si el código ya tiene un ticketId asociado, significa que ya fue usado
      if (result.ticketId) {
        return {
          valid: false,
          organizerId: null,
          alreadyUsed: true,
        };
      }

      return {
        valid: true,
        organizerId: result.organizerId,
        alreadyUsed: false,
      };
    }),
  create: adminProcedure
    .input(
      z.object({
        event: createEventSchema,
        ticketTypes: createTicketTypeSchema.array(),
        organizersInput: organizerSchema.array(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { event, ticketTypes, organizersInput } = input;
      const slug = generateSlug(event.name);

      const organizers = await ctx.db.query.user.findMany({
        where: inArray(
          user.id,
          organizersInput.map((org) => org.id),
        ),
      });

      const existingEvent = await ctx.db.query.event.findMany({
        where: like(eventSchema.slug, `${slug}%`),
      });

      // same slug is slug or slug-1, slug-2, etc
      const sameSlugAmount = existingEvent.filter((event) =>
        event.slug.match(new RegExp(`^${slug}(-\\d+)?$`)),
      ).length;
      const sameSlug =
        sameSlugAmount > 0 ? `${slug}-${sameSlugAmount + 1}` : slug;

      const eventData = {
        name: event.name,
        description: event.description,
        coverImageUrl: event.coverImageUrl,
        startingDate: event.startingDate.toISOString(),
        endingDate: event.endingDate.toISOString(),
        minAge: event.minAge,
        isActive: event.isActive,
        slug: sameSlug,
        locationId: event.locationId,
        categoryId: event.categoryId,
        inviteCondition: event.inviteCondition,
        extraTicketData: event.extraTicketData,
        serviceFee: event.serviceFee,
        emailNotification: event.emailNotification,
        ticketSlugVisibleInPdf: event.ticketSlugVisibleInPdf,
      };

      const { eventCreated, ticketTypesCreated } = await ctx.db.transaction(
        async (tx) => {
          try {
            const [eventCreated] = await tx
              .insert(eventSchema)
              .values(eventData)
              .returning();

            if (!eventCreated) throw 'Error al crear evento';

            let ticketTypesCreated: TicketType[] = [];

            if (ticketTypes.length !== 0) {
              ticketTypesCreated = await tx
                .insert(ticketType)
                .values(
                  ticketTypes.map((ticketType) => ({
                    ...ticketType,
                    maxSellDate: ticketType.maxSellDate?.toISOString(),
                    scanLimit: ticketType.scanLimit?.toISOString(),
                    eventId: eventCreated.id,
                  })),
                )
                .returning();
            }

            // Usuarios boleteria
            if (event.authorizedUsers.length !== 0) {
              await tx.insert(eventXUser).values(
                event.authorizedUsers.map((user) => ({
                  a: eventCreated.id,
                  b: user.id,
                })),
              );
            }

            // Agregar organizadores al evento
            if (organizersInput.length > 0) {
              await tx.insert(eventXorganizer).values(
                organizersInput.map((organizer) => ({
                  eventId: eventCreated.id,
                  organizerId: organizer.id,
                  discountPercentage:
                    event.inviteCondition === 'TRADITIONAL' &&
                    'discountPercentage' in organizer
                      ? organizer.discountPercentage
                      : null,
                  ticketAmount:
                    event.inviteCondition === 'INVITATION' &&
                    'ticketAmount' in organizer
                      ? organizer.ticketAmount
                      : null,
                })),
              );
            }
            // Crear tickets para organizadores
            if (organizersInput.length > 0) {
              // Buscar o crear tipo de ticket "Organizador"
              const organizerTicketType = ticketTypesCreated.find(
                (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
              );

              if (!organizerTicketType) {
                throw new Error(
                  `Tipo de ticket "${ORGANIZER_TICKET_TYPE_NAME}" no encontrado`,
                );
              }

              const [organizerTicketGroup] = await tx
                .insert(ticketGroup)
                .values({
                  eventId: eventCreated.id,
                  status: 'FREE',
                  amountTickets: organizersInput.length,
                  isOrganizerGroup: true,
                })
                .returning();

              let idx = 1;
              for (const organizer of organizersInput) {
                const org = organizers.find((o) => o.id === organizer.id);
                if (!org) {
                  throw new Error('Organizador no encontrado');
                }

                // Crear ticket personal del organizador para entrar al evento
                const [organizerEmittedTicketId] = await tx
                  .insert(emittedTicket)
                  .values({
                    fullName: org.fullName,
                    dni: org.dni,
                    mail: org.email,
                    gender: org.gender,
                    phoneNumber: org.phoneNumber,
                    birthDate: org.birthDate,
                    slug: generateSlug(`${ORGANIZER_TICKET_TYPE_NAME} ${idx}`),
                    ticketTypeId: organizerTicketType.id,
                    ticketGroupId: organizerTicketGroup.id,
                    eventId: eventCreated.id,
                  })
                  .returning({
                    id: emittedTicket.id,
                  });
                idx++;

                // Mandar mail al organizador con su ticket
                const organizerEmittedTicket =
                  await tx.query.emittedTicket.findFirst({
                    where: eq(emittedTicket.id, organizerEmittedTicketId.id),
                    with: {
                      ticketType: true,
                      event: {
                        with: {
                          location: true,
                        },
                      },
                      ticketGroup: {
                        with: {
                          user: {
                            columns: {
                              fullName: true,
                            },
                          },
                        },
                      },
                    },
                  });

                if (!organizerEmittedTicket) {
                  throw new Error('Ticket no encontrado');
                }

                const pdf = await generatePdf({
                  id: organizerEmittedTicket.id,
                  invitedBy:
                    organizerEmittedTicket.ticketGroup.user?.fullName ?? '-',
                  slug: organizerEmittedTicket.slug,
                  eventName: organizerEmittedTicket.event.name,
                  eventDate: organizerEmittedTicket.event.startingDate,
                  eventLocation: organizerEmittedTicket.event.location.address,
                  fullName: organizerEmittedTicket.fullName,
                  dni: organizerEmittedTicket.dni,
                  createdAt: organizerEmittedTicket.createdAt,
                  ticketType: organizerEmittedTicket.ticketType.name,
                  ticketSlugVisibleInPdf:
                    organizerEmittedTicket.event.ticketSlugVisibleInPdf,
                });

                await sendMail({
                  to: org.email,
                  subject: `Ticket de ${organizerEmittedTicket.event.name}`,
                  body: `Hola ${organizerEmittedTicket.fullName}, te enviamos tu ticket de Organizador para ${organizerEmittedTicket.event.name}`,
                  attachments: [Buffer.from(await pdf.arrayBuffer())],
                  eventName: organizerEmittedTicket.event.name,
                });

                if (
                  event.inviteCondition === 'INVITATION' &&
                  'ticketAmount' in organizer &&
                  organizer.ticketAmount !== null
                ) {
                  // Agrupo todos los tickets del organizador en un solo grupo
                  const [thisOrganizerTicketGroup] = await tx
                    .insert(ticketGroup)
                    .values({
                      eventId: eventCreated.id,
                      status: 'FREE',
                      amountTickets: organizer.ticketAmount,
                    })
                    .returning();

                  // MODO INVITACIÓN: Crear solo registros TicketXOrganizer para códigos distribuibles
                  await tx.insert(ticketXorganizer).values(
                    Array.from({ length: organizer.ticketAmount }).map(() => ({
                      eventId: eventCreated.id,
                      organizerId: organizer.id,
                      ticketGroupId: thisOrganizerTicketGroup.id,
                      // ticketId será null hasta que se use el código
                    })),
                  );
                }
              }
            }

            return { eventCreated, ticketTypesCreated };
          } catch (error) {
            console.error(error);
            tx.rollback();
            throw error;
          }
        },
      );

      return { eventCreated, ticketTypesCreated };
    }),
  update: adminProcedure
    .input(
      z.object({
        event: eventSchemaZod,
        ticketTypes: ticketTypeSchema.array(),
        organizersInput: organizerSchema.array(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { event, ticketTypes, organizersInput } = input;

      if (
        event.inviteCondition === 'INVITATION' &&
        organizersInput.length === 0
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Debe agregar al menos un organizador para el evento.',
        });
      }

      const slug = generateSlug(event.name);

      const existingEvent = await ctx.db.query.event.findMany({
        where: like(eventSchema.slug, `${slug}%`),
      });

      // same slug is slug or slug-1, slug-2, etc
      const sameSlugAmount = existingEvent.filter((event) =>
        event.slug.match(new RegExp(`^${slug}-(\\d+)$`)),
      ).length;
      const sameSlug =
        sameSlugAmount > 0 ? `${slug}-${sameSlugAmount + 1}` : slug;

      const eventData = {
        id: event.id,
        name: event.name,
        description: event.description,
        coverImageUrl: event.coverImageUrl,
        startingDate: event.startingDate.toISOString(),
        endingDate: event.endingDate.toISOString(),
        minAge: event.minAge,
        isActive: event.isActive,
        slug: sameSlug,
        locationId: event.locationId,
        categoryId: event.categoryId,
        extraTicketData: event.extraTicketData,
        serviceFee: event.serviceFee,
        emailNotification: event.emailNotification,
        ticketSlugVisibleInPdf: event.ticketSlugVisibleInPdf,
      };

      const { eventUpdated, ticketTypesUpdated } = await ctx.db.transaction(
        async (tx) => {
          try {
            const [eventUpdated] = await tx
              .update(eventSchema)
              .set({
                ...eventData,
              })
              .where(eq(eventSchema.id, eventData.id))
              .returning();

            if (!eventUpdated) throw 'Error al actualizar evento';

            const ticketTypesDB = await tx.query.ticketType.findMany({
              where: eq(ticketType.eventId, eventUpdated.id),
            });
            const deletedTicketTypesIds = ticketTypesDB
              .filter((type) => !ticketTypes.some((t) => t.id === type.id))
              .map((type) => type.id);
            if (deletedTicketTypesIds.length > 0) {
              await tx
                .delete(ticketType)
                .where(inArray(ticketType.id, deletedTicketTypesIds));
            }

            // Obtener el grupo organizador actual para decrementar correctamente
            let currentOrganizerGroup = await tx.query.ticketGroup.findFirst({
              where: and(
                eq(ticketGroup.eventId, eventUpdated.id),
                eq(ticketGroup.isOrganizerGroup, true),
              ),
            });

            // Obtener organizadores actuales de la base de datos
            const organizersDB = await tx.query.eventXorganizer.findMany({
              where: eq(eventXorganizer.eventId, eventUpdated.id),
            });

            // Obtener conteo real de ticketXorganizer para cada organizador (solo INVITATION)
            // Este será la fuente de verdad para la cantidad de tickets
            const organizerTicketCounts = new Map<string, number>();
            if (event.inviteCondition === 'INVITATION') {
              for (const org of organizersDB) {
                const ticketXOrgCount =
                  await tx.query.ticketXorganizer.findMany({
                    where: and(
                      eq(ticketXorganizer.eventId, eventUpdated.id),
                      eq(ticketXorganizer.organizerId, org.organizerId),
                    ),
                  });
                organizerTicketCounts.set(
                  org.organizerId,
                  ticketXOrgCount.length,
                );
              }
            }

            // === ELIMINAR ORGANIZADORES ===
            // Solo eliminar de eventXorganizer para este evento específico
            const deletedOrganizersIds = organizersDB
              .filter(
                (org) => !organizersInput.some((o) => o.id === org.organizerId),
              )
              .map((org) => org.organizerId);

            if (deletedOrganizersIds.length > 0) {
              // Si es evento de tipo INVITATION, eliminar TicketXOrganizer y emittedTicket
              if (event.inviteCondition === 'INVITATION') {
                // Obtener datos de los organizadores eliminados para buscar sus emittedTickets
                const deletedOrganizers = await tx.query.user.findMany({
                  where: inArray(user.id, deletedOrganizersIds),
                  columns: {
                    id: true,
                    dni: true,
                  },
                });

                // Obtener el tipo de ticket "Organizador"
                const organizerTicketType = ticketTypesDB.find(
                  (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
                );

                // Eliminar TicketXOrganizer con ticketId null para cada organizador eliminado
                // Primero obtener los TicketXOrganizer para actualizar los ticketGroups
                const ticketGroupsToUpdate = new Map<string, number>();

                for (const organizerId of deletedOrganizersIds) {
                  const ticketXOrgsToDelete =
                    await tx.query.ticketXorganizer.findMany({
                      where: and(
                        eq(ticketXorganizer.eventId, eventUpdated.id),
                        eq(ticketXorganizer.organizerId, organizerId),
                        isNull(ticketXorganizer.ticketId),
                      ),
                    });

                  // Agrupar por ticketGroupId para actualizar los amountTickets
                  for (const ticketXOrg of ticketXOrgsToDelete) {
                    if (ticketXOrg.ticketGroupId) {
                      const currentCount =
                        ticketGroupsToUpdate.get(ticketXOrg.ticketGroupId) || 0;
                      ticketGroupsToUpdate.set(
                        ticketXOrg.ticketGroupId,
                        currentCount + 1,
                      );
                    }
                  }

                  // Eliminar los TicketXOrganizer
                  await tx
                    .delete(ticketXorganizer)
                    .where(
                      and(
                        eq(ticketXorganizer.eventId, eventUpdated.id),
                        eq(ticketXorganizer.organizerId, organizerId),
                        isNull(ticketXorganizer.ticketId),
                      ),
                    );
                }

                // Actualizar amountTickets de los ticketGroups afectados
                for (const [
                  ticketGroupId,
                  deletedCount,
                ] of ticketGroupsToUpdate.entries()) {
                  const group = await tx.query.ticketGroup.findFirst({
                    where: eq(ticketGroup.id, ticketGroupId),
                  });

                  if (group) {
                    await tx
                      .update(ticketGroup)
                      .set({
                        amountTickets: Math.max(
                          0,
                          group.amountTickets - deletedCount,
                        ),
                      })
                      .where(eq(ticketGroup.id, ticketGroupId));
                  }
                }

                // Eliminar emittedTicket de cada organizador eliminado
                if (organizerTicketType && currentOrganizerGroup) {
                  for (const deletedOrg of deletedOrganizers) {
                    const organizerEmittedTicket =
                      await tx.query.emittedTicket.findFirst({
                        where: and(
                          eq(emittedTicket.eventId, eventUpdated.id),
                          eq(emittedTicket.dni, deletedOrg.dni),
                          eq(
                            emittedTicket.ticketTypeId,
                            organizerTicketType.id,
                          ),
                          eq(
                            emittedTicket.ticketGroupId,
                            currentOrganizerGroup.id,
                          ),
                        ),
                      });

                    if (organizerEmittedTicket) {
                      await tx
                        .delete(emittedTicket)
                        .where(eq(emittedTicket.id, organizerEmittedTicket.id));
                    }
                  }

                  // Actualizar amountTickets del grupo de organizadores
                  const currentCount = deletedOrganizers.length;
                  await tx
                    .update(ticketGroup)
                    .set({
                      amountTickets: Math.max(
                        0,
                        (currentOrganizerGroup.amountTickets ?? 0) -
                          currentCount,
                      ),
                    })
                    .where(eq(ticketGroup.id, currentOrganizerGroup.id));
                }
              }

              // Eliminar SOLO de EventXOrganizer para este evento específico
              await tx
                .delete(eventXorganizer)
                .where(
                  and(
                    eq(eventXorganizer.eventId, eventUpdated.id),
                    inArray(eventXorganizer.organizerId, deletedOrganizersIds),
                  ),
                );
            }

            // === AGREGAR ORGANIZADORES ===
            const addedOrganizersIds = organizersInput
              .filter(
                (o) => !organizersDB.some((org) => org.organizerId === o.id),
              )
              .map((o) => o.id);

            if (addedOrganizersIds.length > 0 && !currentOrganizerGroup) {
              const [newOrganizerGroup] = await tx
                .insert(ticketGroup)
                .values({
                  eventId: eventUpdated.id,
                  status: 'FREE',
                  amountTickets: addedOrganizersIds.length,
                  isOrganizerGroup: true,
                })
                .returning();
              currentOrganizerGroup = newOrganizerGroup;
            }

            // Agregar organizadores según el modo
            if (addedOrganizersIds.length > 0) {
              const addedOrganizers = await tx.query.user.findMany({
                where: inArray(user.id, addedOrganizersIds),
              });

              // Obtener o crear tipo de ticket organizador
              let organizerTicketType = ticketTypesDB.find(
                (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
              );
              if (!organizerTicketType) {
                const [createdOrganizerTicketType] = await tx
                  .insert(ticketType)
                  .values({
                    name: ORGANIZER_TICKET_TYPE_NAME,
                    description: 'Tickets para los organizadores',
                    price: 0,
                    maxAvailable: organizersInput.length,
                    maxPerPurchase: 1,
                    category: 'FREE',
                    lowStockThreshold: null,
                    maxSellDate: null,
                    scanLimit: null,
                    visibleInWeb: false,
                    eventId: eventUpdated.id,
                  })
                  .returning();

                organizerTicketType = createdOrganizerTicketType;
              }

              if (event.inviteCondition === 'TRADITIONAL') {
                // Modo TRADITIONAL: crear EventXOrganizer con discountPercentage
                await tx.insert(eventXorganizer).values(
                  addedOrganizersIds.map((id) => ({
                    eventId: eventUpdated.id,
                    organizerId: id,
                    discountPercentage:
                      (
                        organizersInput.find(
                          (o) => 'discountPercentage' in o && o.id === id,
                        ) as { discountPercentage: number }
                      )?.discountPercentage ?? null,
                    ticketAmount: null,
                  })),
                );

                // Actualizar grupo de organizadores
                const [updatedTicketGroup] = await tx
                  .update(ticketGroup)
                  .set({
                    amountTickets:
                      (currentOrganizerGroup?.amountTickets ?? 0) +
                      addedOrganizersIds.length,
                  })
                  .where(eq(ticketGroup.id, currentOrganizerGroup!.id))
                  .returning();

                // Crear entradas de organizador
                const emittedTickets = await tx
                  .insert(emittedTicket)
                  .values(
                    addedOrganizers.map((org, idx) => ({
                      ticketGroupId: updatedTicketGroup.id,
                      fullName: org.fullName,
                      dni: org.dni,
                      mail: org.email,
                      gender: org.gender,
                      phoneNumber: org.phoneNumber,
                      birthDate: org.birthDate,
                      slug: generateSlug(
                        `${ORGANIZER_TICKET_TYPE_NAME} ${organizersDB.length + idx}`,
                      ),
                      ticketTypeId: organizerTicketType.id,
                      eventId: eventUpdated.id,
                    })),
                  )
                  .returning();

                // Enviar emails con PDFs
                const eventLocation = await tx.query.location.findFirst({
                  where: eq(locationSchema.id, eventUpdated.locationId),
                  columns: {
                    address: true,
                  },
                });
                for (const org of addedOrganizers) {
                  const emittedTicket = emittedTickets.find(
                    (et) => et.dni === org.dni,
                  );
                  if (!emittedTicket) {
                    throw new Error('Ticket no encontrado');
                  }
                  const pdf = await generatePdf({
                    id: emittedTicket.id,
                    invitedBy: '-',
                    slug: emittedTicket.slug,
                    eventName: eventUpdated.name,
                    eventDate: eventUpdated.startingDate,
                    fullName: org.fullName,
                    dni: org.dni,
                    createdAt: emittedTicket.createdAt,
                    ticketType: organizerTicketType.name,
                    eventLocation: eventLocation?.address ?? '-',
                    ticketSlugVisibleInPdf: eventUpdated.ticketSlugVisibleInPdf,
                  });
                  await sendMail({
                    to: org.email,
                    subject: `Ticket de ${eventUpdated.name}`,
                    body: `Hola ${org.fullName}, te enviamos tu ticket de Organizador para ${eventUpdated.name}`,
                    attachments: [Buffer.from(await pdf.arrayBuffer())],
                    eventName: eventUpdated.name,
                  });
                }
              } else if (event.inviteCondition === 'INVITATION') {
                // Modo INVITATION: crear EventXOrganizer, TicketsXOrganizer y entrada de organizador
                for (const addedOrganizerId of addedOrganizersIds) {
                  const organizerInput = organizersInput.find(
                    (o) => o.id === addedOrganizerId,
                  );
                  if (!organizerInput) continue;

                  const ticketAmount =
                    'ticketAmount' in organizerInput &&
                    organizerInput.ticketAmount !== null
                      ? organizerInput.ticketAmount
                      : 0;

                  const org = addedOrganizers.find(
                    (o) => o.id === addedOrganizerId,
                  );
                  if (!org) continue;

                  // Crear EventXOrganizer
                  await tx.insert(eventXorganizer).values({
                    eventId: eventUpdated.id,
                    organizerId: addedOrganizerId,
                    discountPercentage: null,
                    ticketAmount: ticketAmount,
                  });

                  // Crear entrada de organizador (emittedTicket)
                  const [updatedTicketGroup] = await tx
                    .update(ticketGroup)
                    .set({
                      amountTickets:
                        (currentOrganizerGroup?.amountTickets ?? 0) + 1,
                    })
                    .where(eq(ticketGroup.id, currentOrganizerGroup!.id))
                    .returning();

                  const [organizerEmittedTicket] = await tx
                    .insert(emittedTicket)
                    .values({
                      fullName: org.fullName,
                      dni: org.dni,
                      mail: org.email,
                      gender: org.gender,
                      phoneNumber: org.phoneNumber,
                      birthDate: org.birthDate,
                      slug: generateSlug(
                        `${ORGANIZER_TICKET_TYPE_NAME} ${organizersDB.length + addedOrganizersIds.indexOf(addedOrganizerId)}`,
                      ),
                      ticketTypeId: organizerTicketType.id,
                      ticketGroupId: updatedTicketGroup.id,
                      eventId: eventUpdated.id,
                    })
                    .returning({
                      id: emittedTicket.id,
                    });

                  // Enviar email con PDF
                  const organizerEmittedTicketFull =
                    await tx.query.emittedTicket.findFirst({
                      where: eq(emittedTicket.id, organizerEmittedTicket.id),
                      with: {
                        ticketType: true,
                        event: {
                          columns: {
                            name: true,
                            startingDate: true,
                            ticketSlugVisibleInPdf: true,
                          },
                          with: {
                            location: true,
                          },
                        },
                      },
                    });

                  if (organizerEmittedTicketFull) {
                    const pdf = await generatePdf({
                      id: organizerEmittedTicketFull.id,
                      invitedBy: '-',
                      slug: organizerEmittedTicketFull.slug,
                      eventName: organizerEmittedTicketFull.event.name,
                      eventDate: organizerEmittedTicketFull.event.startingDate,
                      eventLocation:
                        organizerEmittedTicketFull.event.location.address,
                      fullName: organizerEmittedTicketFull.fullName,
                      dni: organizerEmittedTicketFull.dni,
                      createdAt: organizerEmittedTicketFull.createdAt,
                      ticketType: organizerEmittedTicketFull.ticketType.name,
                      ticketSlugVisibleInPdf:
                        organizerEmittedTicketFull.event.ticketSlugVisibleInPdf,
                    });

                    await sendMail({
                      to: org.email,
                      subject: `Ticket de ${organizerEmittedTicketFull.event.name}`,
                      body: `Hola ${organizerEmittedTicketFull.fullName}, te enviamos tu ticket de Organizador para ${organizerEmittedTicketFull.event.name}`,
                      attachments: [Buffer.from(await pdf.arrayBuffer())],
                      eventName: organizerEmittedTicketFull.event.name,
                    });
                  }

                  // Crear TicketGroup para este organizador y TicketsXOrganizer
                  if (ticketAmount > 0) {
                    const [thisOrganizerTicketGroup] = await tx
                      .insert(ticketGroup)
                      .values({
                        eventId: eventUpdated.id,
                        status: 'FREE',
                        amountTickets: ticketAmount,
                      })
                      .returning();

                    // Crear registros TicketsXOrganizer con ticketId null
                    await tx.insert(ticketXorganizer).values(
                      Array.from({ length: ticketAmount }).map(() => ({
                        eventId: eventUpdated.id,
                        organizerId: addedOrganizerId,
                        ticketGroupId: thisOrganizerTicketGroup.id,
                        // ticketId será null hasta que se use el código
                      })),
                    );
                  }
                }
              }
            }

            // === ACTUALIZAR CANTIDAD DE TICKETS DE ORGANIZADORES EXISTENTES (SOLO INVITATION) ===
            if (event.inviteCondition === 'INVITATION') {
              // Encontrar organizadores que ya existen pero con cantidad de tickets cambiada
              for (const organizerInput of organizersInput) {
                if (!('ticketAmount' in organizerInput)) continue;

                const existingOrganizer = organizersDB.find(
                  (org) => org.organizerId === organizerInput.id,
                );

                if (!existingOrganizer) continue; // Ya se procesó como nuevo

                const newTicketAmount =
                  organizerInput.ticketAmount !== null
                    ? organizerInput.ticketAmount
                    : 0;

                // Obtener la cantidad actual contando los ticketXorganizer reales
                const currentTicketAmount =
                  organizerTicketCounts.get(organizerInput.id) ?? 0;

                if (newTicketAmount !== currentTicketAmount) {
                  // Contar TicketsXOrganizer con ticketId no null (tickets ya usados/emitidos)
                  const usedTickets = await tx.query.ticketXorganizer.findMany({
                    where: and(
                      eq(ticketXorganizer.eventId, eventUpdated.id),
                      eq(ticketXorganizer.organizerId, organizerInput.id),
                      not(isNull(ticketXorganizer.ticketId)),
                    ),
                  });

                  const usedTicketsCount = usedTickets.length;

                  // La nueva cantidad no puede ser menor a la cantidad de tickets ya usados
                  if (newTicketAmount < usedTicketsCount) {
                    const organizerUser = await tx.query.user.findFirst({
                      where: eq(user.id, organizerInput.id),
                      columns: {
                        fullName: true,
                      },
                    });

                    throw new TRPCError({
                      code: 'BAD_REQUEST',
                      message: `No se puede reducir la cantidad de tickets del organizador ${organizerUser?.fullName || organizerInput.id} a ${newTicketAmount} porque ya se han emitido ${usedTicketsCount} tickets. La cantidad mínima permitida es ${usedTicketsCount}.`,
                    });
                  }

                  // Actualizar ticketAmount en EventXOrganizer
                  await tx
                    .update(eventXorganizer)
                    .set({
                      ticketAmount: newTicketAmount,
                    })
                    .where(
                      and(
                        eq(eventXorganizer.eventId, eventUpdated.id),
                        eq(eventXorganizer.organizerId, organizerInput.id),
                      ),
                    );

                  // Contar registros TicketsXOrganizer existentes con ticketId null
                  // Ordenar por createdAt ascendente para eliminar los primeros (más antiguos)
                  const existingTicketXOrganizers =
                    await tx.query.ticketXorganizer.findMany({
                      where: and(
                        eq(ticketXorganizer.eventId, eventUpdated.id),
                        eq(ticketXorganizer.organizerId, organizerInput.id),
                        isNull(ticketXorganizer.ticketId),
                      ),
                      orderBy: [asc(ticketXorganizer.createdAt)],
                    });

                  const difference = newTicketAmount - currentTicketAmount;

                  if (difference < 0) {
                    // Baja la cantidad: eliminar los primeros n registros
                    const toDelete = existingTicketXOrganizers.slice(
                      0,
                      Math.abs(difference),
                    );

                    // Agrupar por ticketGroupId para actualizar los amountTickets
                    const ticketGroupsToUpdate = new Map<string, number>();

                    for (const ticketXOrg of toDelete) {
                      if (ticketXOrg.ticketGroupId) {
                        const currentCount =
                          ticketGroupsToUpdate.get(ticketXOrg.ticketGroupId) ||
                          0;
                        ticketGroupsToUpdate.set(
                          ticketXOrg.ticketGroupId,
                          currentCount + 1,
                        );
                      }

                      await tx
                        .delete(ticketXorganizer)
                        .where(
                          and(
                            eq(ticketXorganizer.eventId, eventUpdated.id),
                            eq(ticketXorganizer.code, ticketXOrg.code),
                          ),
                        );
                    }

                    // Actualizar amountTickets de los ticketGroups afectados
                    for (const [
                      ticketGroupId,
                      deletedCount,
                    ] of ticketGroupsToUpdate.entries()) {
                      const group = await tx.query.ticketGroup.findFirst({
                        where: eq(ticketGroup.id, ticketGroupId),
                      });

                      if (group) {
                        await tx
                          .update(ticketGroup)
                          .set({
                            amountTickets: Math.max(
                              0,
                              group.amountTickets - deletedCount,
                            ),
                          })
                          .where(eq(ticketGroup.id, ticketGroupId));
                      }
                    }
                  } else if (difference > 0) {
                    // Sube la cantidad: crear registros faltantes
                    // Buscar el ticketGroup del organizador a través de ticketXOrganizers existentes
                    const existingTicketXOrg = existingTicketXOrganizers[0];
                    let organizerTicketGroup;

                    if (existingTicketXOrg?.ticketGroupId) {
                      // Si hay ticketXOrganizers existentes, usar su ticketGroup
                      organizerTicketGroup =
                        await tx.query.ticketGroup.findFirst({
                          where: eq(
                            ticketGroup.id,
                            existingTicketXOrg.ticketGroupId,
                          ),
                        });

                      if (organizerTicketGroup) {
                        await tx
                          .update(ticketGroup)
                          .set({
                            amountTickets:
                              organizerTicketGroup.amountTickets + difference,
                          })
                          .where(eq(ticketGroup.id, organizerTicketGroup.id));
                      }
                    }

                    // Si no hay ticketGroup existente, crear uno nuevo
                    if (!organizerTicketGroup) {
                      const [newTicketGroup] = await tx
                        .insert(ticketGroup)
                        .values({
                          eventId: eventUpdated.id,
                          status: 'FREE',
                          amountTickets: difference,
                        })
                        .returning();
                      organizerTicketGroup = newTicketGroup;
                    }

                    // Crear los registros faltantes
                    await tx.insert(ticketXorganizer).values(
                      Array.from({ length: difference }).map(() => ({
                        eventId: eventUpdated.id,
                        organizerId: organizerInput.id,
                        ticketGroupId: organizerTicketGroup.id,
                        // ticketId será null hasta que se use el código
                      })),
                    );
                  }
                }
              }
            }

            // === ACTUALIZAR discountPercentage DE ORGANIZADORES EXISTENTES (SOLO TRADITIONAL) ===
            if (event.inviteCondition === 'TRADITIONAL') {
              // Encontrar organizadores que ya existen pero con discountPercentage cambiado
              for (const organizerInput of organizersInput) {
                if (!('discountPercentage' in organizerInput)) continue;

                const existingOrganizer = organizersDB.find(
                  (org) => org.organizerId === organizerInput.id,
                );

                if (!existingOrganizer) continue; // Ya se procesó como nuevo

                const newDiscountPercentage =
                  organizerInput.discountPercentage !== null &&
                  organizerInput.discountPercentage !== undefined
                    ? organizerInput.discountPercentage
                    : null;

                // Solo actualizar si el discountPercentage cambió
                if (
                  existingOrganizer.discountPercentage !== newDiscountPercentage
                ) {
                  await tx
                    .update(eventXorganizer)
                    .set({
                      discountPercentage: newDiscountPercentage,
                    })
                    .where(
                      and(
                        eq(eventXorganizer.eventId, eventUpdated.id),
                        eq(eventXorganizer.organizerId, organizerInput.id),
                      ),
                    );
                }
              }
            }

            // === ACTUALIZAR CANTIDAD DE TICKETS DEL TIPO ORGANIZADOR ===
            // Siempre actualizar la cantidad de tickets del tipo ORGANIZER_TICKET_TYPE_NAME
            // con la cantidad total de organizadores
            const organizerTicketType = ticketTypesDB.find(
              (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
            );

            if (organizerTicketType) {
              await tx
                .update(ticketType)
                .set({
                  maxAvailable: organizersInput.length,
                })
                .where(eq(ticketType.id, organizerTicketType.id));
            }

            const ticketTypesUpdated = await Promise.all(
              ticketTypes.map(async (type) => {
                // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
                const { id, ...rest } = type;
                if (ticketTypesDB.find((t) => t.id === type.id)) {
                  const [updated] = await tx
                    .update(ticketType)
                    .set({
                      ...rest,
                      maxSellDate: type.maxSellDate?.toISOString(),
                      scanLimit: type.scanLimit?.toISOString(),
                      eventId: eventUpdated.id,
                    })
                    .where(eq(ticketType.id, type.id))
                    .returning();

                  return updated;
                } else if (type.id) {
                  const [created] = await tx
                    .insert(ticketType)
                    .values({
                      ...rest,
                      maxSellDate: type.maxSellDate?.toISOString(),
                      scanLimit: type.scanLimit?.toISOString(),
                      eventId: eventUpdated.id,
                    })
                    .returning();

                  return created;
                }
              }),
            );

            await tx
              .delete(eventXUser)
              .where(eq(eventXUser.a, eventUpdated.id));

            if (event.authorizedUsers.length !== 0) {
              await tx.insert(eventXUser).values(
                event.authorizedUsers.map((user) => ({
                  a: eventUpdated.id,
                  b: user.id,
                })),
              );
            }

            return { eventUpdated, ticketTypesUpdated };
          } catch (error) {
            // Drizzle hace rollback automáticamente cuando se lanza un error
            // Si el error es un TRPCError, lo propagamos tal cual para mantener el mensaje
            if (error instanceof TRPCError) {
              throw error;
            }
            // Si es otro tipo de error, lo convertimos en un TRPCError
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message:
                error instanceof Error
                  ? error.message
                  : 'Error al actualizar el evento',
            });
          }
        },
      );

      revalidatePath(`/admin/event/edit/${event.slug}`);
      revalidatePath('/admin/event');

      return { eventUpdated, ticketTypesUpdated };
    }),
  generatePresentismoOrderNamePDF: ticketingProcedure
    .input(
      z.object({
        eventId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { eventId } = input;
      const event = await ctx.db.query.event.findFirst({
        where: eq(eventSchema.id, eventId),
        with: {
          ticketTypes: true,
          location: {
            columns: {
              address: true,
            },
          },
          ticketGroups: {
            with: {
              emittedTickets: {
                with: {
                  ticketType: true,
                },
              },
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!event) throw 'Evento no encontrado';

      const tickets = event.ticketGroups
        .flatMap((group) =>
          group.emittedTickets.map((ticket) => ({
            ...ticket,
            invitedBy: group.user?.fullName ?? '-',
          })),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      const pdfData: PDFDataOrderName = [
        {
          qr: `${process.env.INSTANCE_WEB_URL}/admin/event/${event.slug}`,
          ubicacion: event.location.address,
          nombre: event.name,
          fecha: formatInTimeZone(
            event.startingDate,
            'America/Argentina/Buenos_Aires',
            'dd/MM/yyyy',
          ),
          datos: tickets.map((ticket) => [
            ticket.fullName,
            ticket.ticketType.name,
            ticket.phoneNumber,
            ticket.dni,
            ticket.invitedBy || '-',
            ticket.scanned ? '☑' : '☐',
          ]),
          entradasVendidas: `${tickets.length} de ${event.ticketTypes.reduce(
            (acc, ticketType) => acc + ticketType.maxAvailable,
            0,
          )}`,
        },
      ];

      const plugins = {
        qrcode: barcodes.qrcode,
        text,
        line,
        table,
      };

      const { fontBold, fontSemiBold, fontLight, fontSymbols } =
        await getDMSansFonts();

      const font: Font = {
        'DMSans-Bold': {
          data: fontBold, // Provide the buffer instead of a string path
        },
        'DMSans-SemiBold': {
          data: fontSemiBold, // Provide the buffer instead of a string path
          fallback: true,
        },
        'DMSans-Light': {
          data: fontLight, // Provide the buffer instead of a string path
        },
        Symbols: {
          data: fontSymbols, // Provide the buffer instead of a string path
        },
      };

      try {
        const pdf = await generate({
          template: presentismoPDFSchema(),
          inputs: pdfData,
          plugins,
          options: {
            font,
          },
        });
        return pdf;
      } catch (error) {
        throw error;
      }
    }),
  exportXlsxByTicketType: adminProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.event.findFirst({
        where: eq(eventSchema.id, input),
        with: {
          ticketTypes: true,
        },
      });

      if (!event) {
        throw 'Evento no encontrado';
      }

      const tickets = await ctx.db.query.emittedTicket.findMany({
        where: eq(emittedTicket.eventId, input),
        with: {
          ticketType: true,
          ticketGroup: {
            with: {
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      const grouped: Record<string, typeof tickets> = {};
      for (const t of tickets) {
        const key = t.ticketType?.name ?? 'Sin tipo';
        if (!grouped[key]) grouped[key] = [] as typeof tickets;
        grouped[key].push(t);
      }

      const wb = XLSX.utils.book_new();

      for (const ticketType of event.ticketTypes) {
        const typeName = ticketType.name;
        const rows = grouped[typeName] || [];

        const headers = [
          'DNI/Pasaporte',
          'Nombre',
          'Mail',
          'Teléfono',
          'Instagram',
          'Género',
          'Fecha de Nacimiento',
          'Fecha de Emisión',
          'Usado',
          'Invitado por',
        ];
        const aoa = [
          headers,
          ...rows.map((t) => [
            t.dni,
            t.fullName,
            t.mail,
            t.phoneNumber ?? '',
            t.instagram ?? '',
            t.gender
              ? (genderTranslation[
                  t.gender as keyof typeof genderTranslation
                ] ?? t.gender)
              : '',
            t.birthDate ? new Date(t.birthDate) : '',
            t.createdAt ? new Date(t.createdAt) : '',
            t.scanned ? 'Sí' : 'No',
            t.ticketGroup.user?.fullName ?? '-',
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, typeName.slice(0, 31));
      }

      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Uint8Array(out as ArrayBuffer);
    }),
  generatePresentismoGroupedTicketTypePDF: ticketingProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { eventId } = input;
      const event = await ctx.db.query.event.findFirst({
        where: eq(eventSchema.id, eventId),
        with: {
          ticketTypes: true,
          location: {
            columns: {
              address: true,
            },
          },
          ticketGroups: {
            with: {
              emittedTickets: {
                with: {
                  ticketType: true,
                },
              },
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!event) throw 'Evento no encontrado';

      const tickets = event.ticketTypes.map((ticketType) => {
        return {
          ticketType: ticketType.name,
          tickets: event.ticketGroups
            .flatMap((group) =>
              group.emittedTickets.map((ticket) => ({
                ...ticket,
                invitedBy: group.user?.fullName ?? '-',
              })),
            )
            .filter((ticket) => ticket.ticketType.id === ticketType.id)
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        };
      });

      const pdfData: PDFDataGroupedTicketType = [
        {
          qr: `${process.env.INSTANCE_WEB_URL}/admin/event/${event.slug}`,
          ubicacion: event.location.address,
          nombre: event.name,
          fecha: formatInTimeZone(
            event.startingDate,
            'America/Argentina/Buenos_Aires',
            'dd/MM/yyyy',
          ),
          ...tickets.reduce(
            (acc, ticket) => {
              acc[`datos_${ticket.ticketType}`] = ticket.tickets.map(
                (ticket) => [
                  ticket.fullName,
                  ticket.ticketType.name,
                  ticket.phoneNumber,
                  ticket.dni,
                  ticket.invitedBy || '-',
                  ticket.scanned ? '☑' : '☐',
                ],
              );
              return acc;
            },
            {} as Record<
              `datos_${string}`,
              [string, string, string, string, string, string][]
            >,
          ),
          ...tickets.reduce(
            (acc, ticket) => {
              acc[`tipo_entrada_${ticket.ticketType}`] =
                `Tipo de ticket: ${ticket.ticketType}`;
              return acc;
            },
            {} as Record<`tipo_entrada_${string}`, string>,
          ),
          entradasVendidas: `${tickets.reduce(
            (acc, ticket) => acc + ticket.tickets.length,
            0,
          )} de ${event.ticketTypes.reduce(
            (acc, ticketType) => acc + ticketType.maxAvailable,
            0,
          )}`,
        },
      ];

      const { fontBold, fontSemiBold, fontLight, fontSymbols } =
        await getDMSansFonts();

      const font: Font = {
        'DMSans-Bold': {
          data: fontBold, // Provide the buffer instead of a string path
        },
        'DMSans-SemiBold': {
          data: fontSemiBold, // Provide the buffer instead of a string path
          fallback: true,
        },
        'DMSans-Light': {
          data: fontLight, // Provide the buffer instead of a string path
        },
        Symbols: {
          data: fontSymbols, // Provide the buffer instead of a string path
        },
      };

      const plugins = {
        qrcode: barcodes.qrcode,
        text,
        line,
        table,
      };

      try {
        const pdf = await generate({
          template: presentismoPDFSchemaGroupedTicketType(tickets),
          inputs: pdfData,
          plugins,
          options: {
            font,
          },
        });

        return pdf;
      } catch (error) {
        throw error;
      }
    }),
  toggleActivate: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { id, isActive } = input;
      await ctx.db
        .update(eventSchema)
        .set({ isActive })
        .where(eq(eventSchema.id, id));
    }),
  delete: adminProcedure
    .input(eventSchemaZod.shape.id)
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.event.findFirst({
        where: eq(eventSchema.id, input),
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Evento no encontrado',
        });
      }

      if (event.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se puede eliminar un evento activo',
        });
      }

      const deletedEvent = await ctx.db
        .update(eventSchema)
        .set({ isDeleted: true })
        .where(and(eq(eventSchema.id, input), eq(eventSchema.isActive, false)))
        .returning();

      if (deletedEvent.length === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Error al eliminar el evento',
        });
      }

      return deletedEvent[0];
    }),
});
