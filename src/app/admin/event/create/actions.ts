'use server';

import {
  type CreateEventSchema,
  createEventSchema,
} from '@/server/schemas/event';
import { differenceInMinutes } from 'date-fns';
import z from 'zod';

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
