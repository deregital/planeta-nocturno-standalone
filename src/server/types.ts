import { type ticketType, type user } from '@/drizzle/schema';

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
export type TicketType = typeof ticketType.$inferSelect;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
