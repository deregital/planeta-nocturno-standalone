import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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

export const controlRoles = pgTable('control_roles', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull().unique(),
  description: text(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const controlRolePermissions = pgTable(
  'control_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => controlRoles.id, { onDelete: 'cascade' }),
    permission: varchar({ length: 64 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

export const controlAdmins = pgTable('control_admins', {
  id: uuid().primaryKey().defaultRandom(),
  username: varchar({ length: 100 }).notNull().unique(),
  email: varchar({ length: 320 }).notNull().unique(),
  password: text().notNull(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => controlRoles.id, { onDelete: 'restrict' }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
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

/** Subdominios anteriores de cada plataforma: redirigen durante un tiempo tras el cambio. */
export const tenantSlugAliases = pgTable(
  'tenant_slug_aliases',
  {
    slug: varchar({ length: 63 }).primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('tenant_slug_aliases_tenant_id_idx').on(table.tenantId)],
);

/** Etiquetas personales: solo las ve y usa el administrador que las creó. */
export const tenantTags = pgTable(
  'tenant_tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    controlAdminId: uuid('control_admin_id')
      .notNull()
      .references(() => controlAdmins.id, { onDelete: 'cascade' }),
    name: varchar({ length: 50 }).notNull(),
    color: varchar({ length: 7 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('tenant_tags_admin_name_unique').on(
      table.controlAdminId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const tenantTagAssignments = pgTable(
  'tenant_tag_assignments',
  {
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tenantTags.id, { onDelete: 'cascade' }),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.tenantId] }),
    index('tenant_tag_assignments_tenant_id_idx').on(table.tenantId),
  ],
);

export const controlRolesRelations = relations(controlRoles, ({ many }) => ({
  permissions: many(controlRolePermissions),
  admins: many(controlAdmins),
}));

export const controlRolePermissionsRelations = relations(
  controlRolePermissions,
  ({ one }) => ({
    role: one(controlRoles, {
      fields: [controlRolePermissions.roleId],
      references: [controlRoles.id],
    }),
  }),
);

export const controlAdminsRelations = relations(controlAdmins, ({ one }) => ({
  role: one(controlRoles, {
    fields: [controlAdmins.roleId],
    references: [controlRoles.id],
  }),
}));
