import { type Font } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { barcodes, line, table, text } from '@pdfme/schemas';
import { TRPCError } from '@trpc/server';
import { formatInTimeZone } from 'date-fns-tz';
import { and, desc, eq, gt, inArray, like, lt, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';
import z from 'zod';

import {
  emittedTicket,
  event as eventSchema,
  eventXorganizer,
  eventXUser,
  ticketGroup,
  ticketType,
  location as locationSchema,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { genderTranslation } from '@/lib/translations';
import {
  createEventSchema,
  eventSchema as eventSchemaZod,
} from '@/server/schemas/event';
import {
  createTicketTypeSchema,
  ticketTypeSchema,
} from '@/server/schemas/ticket-type';
import {
  adminProcedure,
  publicProcedure,
  router,
  ticketingProcedure,
} from '@/server/trpc';
import { type TicketType } from '@/server/types';
import {
  type PDFDataGroupedTicketType,
  type PDFDataOrderName,
  presentismoPDFSchema,
  presentismoPDFSchemaGroupedTicketType,
} from '@/server/utils/presentismo-pdf';
import { generateSlug, getDMSansFonts } from '@/server/utils/utils';
import { organizerSchema } from '@/server/schemas/organizer';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { generatePdf } from '@/server/utils/ticket-template';
import { sendMail } from '@/server/services/mail';

export const eventsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const pastEvents = await ctx.db.query.event.findMany({
      where: and(
        eq(eventSchema.isDeleted, false),
        lte(eventSchema.endingDate, new Date().toISOString()),
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

    const upcomingEvents = await ctx.db.query.event.findMany({
      where: and(
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

      const pastEvents = await ctx.db.query.event.findMany({
        where: and(
          eq(eventSchema.isDeleted, false),
          lte(eventSchema.endingDate, new Date().toISOString()),
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

      const upcomingEvents = await ctx.db.query.event.findMany({
        where: and(
          eq(eventSchema.isDeleted, false),
          gt(eventSchema.endingDate, new Date().toISOString()),
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
      });

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
                });

                await sendMail({
                  to: org.email,
                  subject: `Ticket de ${organizerEmittedTicket.event.name}`,
                  body: `Hola ${organizerEmittedTicket.fullName}, te enviamos tu ticket de Orgainzador para ${organizerEmittedTicket.event.name}`,
                  attachments: [Buffer.from(await pdf.arrayBuffer())],
                  eventName: organizerEmittedTicket.event.name,
                });

                if (
                  event.inviteCondition === 'INVITATION' &&
                  'ticketAmount' in organizer
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

            // Eliminar organizadores que no están en la lista de organizadores input
            const organizersDB = await tx.query.eventXorganizer.findMany({
              where: eq(eventXorganizer.eventId, eventUpdated.id),
            });
            const deletedOrganizersIds = organizersDB
              .filter(
                (org) => !organizersInput.some((o) => o.id === org.organizerId),
              )
              .map((org) => org.organizerId);
            if (deletedOrganizersIds.length > 0) {
              const deletedOrganizersDnis = (
                await tx.query.user.findMany({
                  where: inArray(user.id, deletedOrganizersIds),
                  columns: {
                    dni: true,
                  },
                })
              ).map((o) => o.dni);
              await tx
                .delete(eventXorganizer)
                .where(
                  inArray(eventXorganizer.organizerId, deletedOrganizersIds),
                );

              if (currentOrganizerGroup) {
                await tx
                  .update(ticketGroup)
                  .set({
                    amountTickets: Math.max(
                      0,
                      currentOrganizerGroup.amountTickets -
                        deletedOrganizersIds.length,
                    ),
                  })
                  .where(
                    and(
                      eq(ticketGroup.eventId, eventUpdated.id),
                      eq(ticketGroup.isOrganizerGroup, true),
                    ),
                  );
              }

              await tx
                .delete(emittedTicket)
                .where(
                  and(
                    eq(emittedTicket.eventId, eventUpdated.id),
                    inArray(emittedTicket.dni, deletedOrganizersDnis),
                  ),
                );
            }

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

            if (
              addedOrganizersIds.length > 0 &&
              event.inviteCondition === 'TRADITIONAL'
            ) {
              await tx.insert(eventXorganizer).values(
                addedOrganizersIds.map((id) => ({
                  eventId: eventUpdated.id,
                  organizerId: id,
                  discountPercentage: (
                    organizersInput.find(
                      (o) => 'discountPercentage' in o && o.id === id,
                    ) as { discountPercentage: number }
                  ).discountPercentage,
                })),
              );

              const [updatedTicketGroup] = await tx
                .update(ticketGroup)
                .set({
                  amountTickets:
                    (currentOrganizerGroup?.amountTickets ?? 0) +
                    addedOrganizersIds.length,
                })
                .where(eq(ticketGroup.id, currentOrganizerGroup!.id))
                .returning();
              const addedOrganizers = await tx.query.user.findMany({
                where: inArray(user.id, addedOrganizersIds),
              });
              const organizerTicketType = ticketTypesDB.find(
                (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
              );
              if (!organizerTicketType) {
                throw new Error(
                  `Tipo de ticket "${ORGANIZER_TICKET_TYPE_NAME}" no encontrado`,
                );
              }
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
                });
                await sendMail({
                  to: org.email,
                  subject: `Ticket de ${eventUpdated.name}`,
                  body: `Hola ${org.fullName}, te enviamos tu ticket de Orgainzador para ${eventUpdated.name}`,
                  attachments: [Buffer.from(await pdf.arrayBuffer())],
                  eventName: eventUpdated.name,
                });
              }
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
            tx.rollback();
            throw error;
          }
        },
      );

      revalidatePath(`/admin/event/edit/${event.slug}`);

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
          qr: `${process.env.PLANETA_NOCTURNO_URL}/admin/event/${event.slug}`,
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
          qr: `${process.env.PLANETA_NOCTURNO_URL}/admin/event/${event.slug}`,
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
                `Tipo de entrada: ${ticket.ticketType}`;
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
