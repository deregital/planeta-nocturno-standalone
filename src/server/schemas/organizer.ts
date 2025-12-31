import z from 'zod';

import { userSchema } from '@/server/schemas/user';

export const organizerBaseSchema = z.object({
  dni: userSchema.shape.dni,
  id: z.uuid(),
  fullName: userSchema.shape.fullName,
  phoneNumber: userSchema.shape.phoneNumber,
  role: userSchema.shape.role,
});

export const organizerTraditionalSchema = z.object({
  ...organizerBaseSchema.shape,
  type: z.literal('TRADITIONAL'),
  discountPercentage: z.number().min(0).max(100).nullable(),
});

export const organizerInvitationSchema = z.object({
  ...organizerBaseSchema.shape,
  type: z.literal('INVITATION'),
  ticketAmount: z.number().min(0).nullable(),
});

export type OrganizerTraditionalSchema = z.infer<
  typeof organizerTraditionalSchema
>;
export type OrganizerInvitationSchema = z.infer<
  typeof organizerInvitationSchema
>;
export type OrganizerBaseSchema = z.infer<typeof organizerBaseSchema>;

export const organizerSchema = z.union([
  organizerTraditionalSchema,
  organizerInvitationSchema,
]);

export type OrganizerSchema = z.infer<typeof organizerSchema>;
