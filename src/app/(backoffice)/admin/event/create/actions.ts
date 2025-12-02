'use server';

import { differenceInMinutes } from 'date-fns';
import z from 'zod';

import {
  type CreateEventSchema,
  createEventSchema,
} from '@/server/schemas/event';
import {
  type CreateTicketTypeSchema,
  createTicketTypeSchema,
} from '@/server/schemas/ticket-type';

const generalEventSchema = createEventSchema.pick({
  name: true,
  description: true,
  coverImageUrl: true,
  startingDate: true,
  endingDate: true,
  categoryId: true,
  isActive: true,
  locationId: true,
  minAge: true,
  emailNotification: true,
  serviceFee: true,
});

export async function validateGeneralInformation(
  event: Pick<
    CreateEventSchema,
    | 'name'
    | 'description'
    | 'coverImageUrl'
    | 'startingDate'
    | 'endingDate'
    | 'categoryId'
    | 'isActive'
    | 'locationId'
    | 'minAge'
    | 'emailNotification'
    | 'serviceFee'
  >,
) {
  const validatedEvent = generalEventSchema.safeParse(event);

  if (!validatedEvent.success) {
    return {
      success: false,
      data: event,
      error: z.treeifyError(validatedEvent.error).properties,
    };
  }

  if (differenceInMinutes(event.endingDate, event.startingDate) <= 0) {
    return {
      success: false,
      data: event,
      error: {
        endingDate: {
          errors: ['La fecha de fin debe ser mayor a la fecha de inicio'],
        },
      },
    };
  }

  return { success: true, data: validatedEvent.data, error: null };
}

export async function validateTicketType(
  ticketType: CreateTicketTypeSchema,
  eventStartDate: Date,
  eventEndDate: Date,
  maxAvailableLeft: number,
) {
  const validation = createTicketTypeSchema.safeParse(ticketType);

  if (!validation.success) {
    return {
      success: false,
      data: ticketType,
      error: z.treeifyError(validation.error).properties,
    };
  }

  const errors: Record<string, { errors: string[] }> = {};

  if (
    validation.data.category !== 'FREE' &&
    (!validation.data.price || validation.data.price <= 0)
  ) {
    errors.price = {
      errors: ['El precio es requerido'],
    };
  }

  // Validate maxAvailable doesn't exceed available tickets
  if (validation.data.maxAvailable > maxAvailableLeft) {
    errors.maxAvailable = {
      errors: [
        `La cantidad máxima de tickets disponibles es ${maxAvailableLeft}`,
      ],
    };
  }

  // Validate scanLimit is not after event end
  if (validation.data.scanLimit && validation.data.scanLimit > eventEndDate) {
    errors.scanLimit = {
      errors: [
        'La fecha de finalización de escaneo de tickets no puede ser mayor a la fecha de finalización del evento',
      ],
    };
  }

  // Validate maxSellDate is not after event end
  if (
    validation.data.maxSellDate &&
    validation.data.maxSellDate > eventEndDate
  ) {
    errors.maxSellDate = {
      errors: [
        'La fecha de finalización de venta de tickets no puede ser mayor a la fecha de finalización del evento',
      ],
    };
  }

  // Validate lowStockThreshold is not greater than maxAvailable
  if (
    validation.data.lowStockThreshold &&
    validation.data.lowStockThreshold > validation.data.maxAvailable
  ) {
    errors.lowStockThreshold = {
      errors: [
        `La cantidad de tickets no puede ser mayor a la cantidad de tickets disponibles (${validation.data.maxAvailable})`,
      ],
    };
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      data: ticketType,
      error: errors,
    };
  }

  return { success: true, data: validation.data, error: null };
}
