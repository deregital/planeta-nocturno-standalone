import { user } from '@/drizzle/schema';

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
