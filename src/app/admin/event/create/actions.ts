'use server';

import {
  type CreateEventSchema,
  createEventSchema,
} from '@/server/schemas/event';
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

  return { success: true, data: validatedEvent.data, error: null };
}
