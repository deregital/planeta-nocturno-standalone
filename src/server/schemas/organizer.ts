import z from 'zod';

import { userSchema } from '@/server/schemas/user';

export const organizerTraditionalSchema = z.object({
  dni: userSchema.shape.dni,
  discountPercentage: z.number().min(0).max(100),
});

export const organizerInvitationSchema = z.object({
  dni: userSchema.shape.dni,
  ticketAmount: z.number().min(0),
});

export type OrganizerTraditionalSchema = z.infer<
  typeof organizerTraditionalSchema
>;
export type OrganizerInvitationSchema = z.infer<
  typeof organizerInvitationSchema
>;

export const organizerSchema = z.discriminatedUnion('type', [
  organizerTraditionalSchema,
  organizerInvitationSchema,
]);

export type OrganizerSchema = z.infer<typeof organizerSchema>;
