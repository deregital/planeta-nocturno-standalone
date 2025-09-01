import {
  type ticketTypeCategory,
  type ticketType,
  type user,
  type emittedTicket,
  type ticketGroup,
} from '@/drizzle/schema';

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
export type TicketType = typeof ticketType.$inferSelect;
export type InsertTicketType = typeof ticketType.$inferInsert;
export type EmittedTicket = typeof emittedTicket.$inferSelect;

export type TicketGroupStatus = (typeof ticketGroup.status.enumValues)[number];

export type TicketTypeCategory = (typeof ticketTypeCategory.enumValues)[number];

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
