import { differenceInMinutes } from 'date-fns';
import z from 'zod';

import { type EventFormState } from '@/app/(backoffice)/admin/event/create/state';
import {
  type CreateEventSchema,
  createEventSchema,
} from '@/server/schemas/event';
import { type TicketTypeSchema } from '@/server/schemas/ticket-type';

const generalEventSchema = createEventSchema.pick({
  name: true,
  description: true,
  coverImageUrl: true,
  videoUrl: true,
  startingDate: true,
  endingDate: true,
  categoryId: true,
  isActive: true,
  locationId: true,
  minAge: true,
  emailNotification: true,
  serviceFee: true,
});

type GeneralEventInformation = Pick<
  CreateEventSchema,
  keyof typeof generalEventSchema.shape
>;

/**
 * Corre en el navegador. Antes era una server action y el editor le mandaba
 * el evento entero, con todas las entradas emitidas: en un evento de 700
 * entradas pasaba el límite de 1 MB del body y no se podía guardar.
 */
export function validateGeneralInformation(event: GeneralEventInformation) {
  const validatedEvent = generalEventSchema.safeParse(event);

  if (!validatedEvent.success) {
    return {
      success: false,
      data: event,
      error: z.treeifyError(validatedEvent.error).properties,
    } as const;
  }

  if (
    event.startingDate &&
    event.endingDate &&
    differenceInMinutes(event.endingDate, event.startingDate) <= 0
  ) {
    return {
      success: false,
      data: event,
      error: {
        endingDate: {
          errors: ['La fecha de fin debe ser mayor a la fecha de inicio'],
        },
      },
    } as const;
  }

  return { success: true, data: validatedEvent.data, error: null } as const;
}

/**
 * Sólo los campos del formulario. El evento de `getBySlug` trae las
 * relaciones (ticketGroups con cada entrada emitida, eventXUsers, …) y, si se
 * copiaban al store, viajaban en cada guardado y crecían con lo vendido.
 */
export function pickEventFormFields(
  source: Omit<EventFormState, 'id'>,
): Omit<EventFormState, 'id' | 'inviteCondition'> {
  return {
    name: source.name,
    description: source.description,
    coverImageUrl: source.coverImageUrl,
    videoUrl: source.videoUrl,
    startingDate: source.startingDate,
    endingDate: source.endingDate,
    minAge: source.minAge,
    isActive: source.isActive,
    locationId: source.locationId,
    categoryId: source.categoryId,
    authorizedUsers: source.authorizedUsers.map((user) => ({
      id: user.id,
      name: user.name,
    })),
    extraTicketData: source.extraTicketData,
    serviceFee: source.serviceFee,
    emailNotification: source.emailNotification,
    ticketSlugVisibleInPdf: source.ticketSlugVisibleInPdf,
    hasSimpleInvitation: source.hasSimpleInvitation,
    descriptionTitleVisible: source.descriptionTitleVisible,
  };
}

/** Lo mismo para un tipo de ticket: fuera `ticketTypeXOrganizers`, `eventId`, … */
export function pickTicketTypeFields(
  source: TicketTypeSchema,
): TicketTypeSchema {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    price: source.price,
    maxPerPurchase: source.maxPerPurchase,
    maxAvailable: source.maxAvailable,
    maxSellDate: source.maxSellDate,
    category: source.category,
    startingDate: source.startingDate,
    scanLimit: source.scanLimit,
    allowMultipleScans: source.allowMultipleScans,
    visibleInWeb: source.visibleInWeb,
    lowStockThreshold: source.lowStockThreshold,
    imageUrl: source.imageUrl,
    organizers: source.organizers,
    // Sin el slug, el server lo regenera a partir del nombre.
    ...(source.slug !== undefined && { slug: source.slug }),
  };
}
