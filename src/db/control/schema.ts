import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const tenantPlan = pgEnum('tenant_plan', ['free', 'pro']);
export const tenantStatus = pgEnum('tenant_status', [
  'provisioning',
  'active',
  'suspended',
  'failed',
  'deleting',
  'deleted',
]);

export const controlAdmins = pgTable('control_admins', {
  id: uuid().primaryKey().defaultRandom(),
  username: varchar({ length: 100 }).notNull().unique(),
  email: varchar({ length: 320 }).notNull().unique(),
  password: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tenants = pgTable('tenants', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  customId: varchar('custom_id', { length: 100 }).unique(),
  slug: varchar({ length: 63 }).notNull().unique(),
  name: varchar({ length: 255 }).notNull(),
  comments: text(),
  description: text(),
  contactEmail: varchar('contact_email', { length: 320 }),
  faviconUrl: text('favicon_url'),
  hue: integer(),
  saturation: integer(),
  mpAccessToken: text('mp_access_token'),
  mpRefreshToken: text('mp_refresh_token'),
  mpAccessTokenExpiresAt: timestamp('mp_access_token_expires_at', {
    withTimezone: true,
  }),
  createdByControlAdminId: uuid('created_by_control_admin_id').references(
    () => controlAdmins.id,
    { onDelete: 'set null' },
  ),
  databaseName: varchar('database_name', { length: 63 }).unique(),
  plan: tenantPlan().notNull().default('free'),
  status: tenantStatus().notNull().default('provisioning'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
