import z from 'zod';

import { userSchema } from '@/server/schemas/user';

export const organizerBaseSchema = z.object({
  dni: userSchema.shape.dni,
  fullName: userSchema.shape.fullName,
  phoneNumber: userSchema.shape.phoneNumber,
});

export const organizerTraditionalSchema = z.object({
  ...organizerBaseSchema.shape,
  discountPercentage: z.number().min(0).max(100),
});

export const organizerInvitationSchema = z.object({
  ...organizerBaseSchema.shape,
  ticketAmount: z.number().min(0),
});

export type OrganizerTraditionalSchema = z.infer<
  typeof organizerTraditionalSchema
>;
export type OrganizerInvitationSchema = z.infer<
  typeof organizerInvitationSchema
>;
export type OrganizerBaseSchema = z.infer<typeof organizerBaseSchema>;

export const organizerSchema = z.discriminatedUnion('type', [
  organizerTraditionalSchema,
  organizerInvitationSchema,
]);

export type OrganizerSchema = z.infer<typeof organizerSchema>;
