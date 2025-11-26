import {
  type emittedTicket,
  type inviteCondition,
  type role,
  type tag,
  type ticketGroup,
  type ticketType,
  type ticketTypeCategory,
  type user,
} from '@/drizzle/schema';

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
export type TicketType = typeof ticketType.$inferSelect;
export type Tag = typeof tag.$inferSelect;
export type InsertTicketType = typeof ticketType.$inferInsert;
export type EmittedTicket = typeof emittedTicket.$inferSelect;

export type TicketGroupStatus = (typeof ticketGroup.status.enumValues)[number];

export type TicketTypeCategory = (typeof ticketTypeCategory.enumValues)[number];

export type InviteCondition = (typeof inviteCondition.enumValues)[number];

export type Role = (typeof role.enumValues)[number];

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
