import {
  pgTable,
  varchar,
  timestamp,
  text,
  integer,
  uniqueIndex,
  foreignKey,
  uuid,
  boolean,
  doublePrecision,
  index,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const inviteCondition = pgEnum('InviteCondition', [
  'TRADITIONAL',
  'INVITATION',
]);
export const role = pgEnum('Role', ['ADMIN', 'TICKETING', 'RRPP']);
export const ticketGroupStatus = pgEnum('TicketGroupStatus', [
  'BOOKED',
  'PAID',
  'FREE',
]);
export const ticketTypeCategory = pgEnum('TicketTypeCategory', [
  'FREE',
  'PAID',
  'TABLE',
]);

export const prismaMigrations = pgTable('_prisma_migrations', {
  id: varchar({ length: 36 }).primaryKey().notNull(),
  checksum: varchar({ length: 64 }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  migrationName: varchar('migration_name', { length: 255 }).notNull(),
  logs: text(),
  rolledBackAt: timestamp('rolled_back_at', {
    withTimezone: true,
    mode: 'string',
  }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
  appliedStepsCount: integer('applied_steps_count').default(0).notNull(),
});

export const session = pgTable(
  'session',
  {
    sessionToken: text().notNull(),
    userId: uuid().notNull(),
    expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('session_sessionToken_key').using(
      'btree',
      table.sessionToken.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'session_userId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const location = pgTable('location', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  address: text().notNull(),
  googleMapsUrl: text().notNull(),
  capacity: integer().notNull(),
  createdAt: timestamp({ withTimezone: true, mode: 'string' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const eventCategory = pgTable('eventCategory', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true, mode: 'string' })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const ticketGroup = pgTable(
  'ticketGroup',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    status: ticketGroupStatus().notNull(),
    amountTickets: integer().default(0).notNull(),
    eventId: uuid('event_id').notNull(),
    invitedBy: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [event.id],
      name: 'ticketGroup_event_id_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const emittedTicket = pgTable(
  'emittedTicket',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    fullName: text().notNull(),
    dni: text().notNull(),
    mail: text().notNull(),
    gender: text().notNull(),
    phoneNumber: text().notNull(),
    instagram: text(),
    birthDate: text().notNull(),
    paidOnLocation: boolean().default(false).notNull(),
    scanned: boolean().default(false).notNull(),
    scannedAt: timestamp({ withTimezone: true, mode: 'string' }),
    scannedByUserId: uuid(),
    ticketTypeId: uuid().notNull(),
    ticketGroupId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    eventId: uuid(),
  },
  (table) => [
    foreignKey({
      columns: [table.scannedByUserId],
      foreignColumns: [user.id],
      name: 'emittedTicket_scannedByUserId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.ticketTypeId],
      foreignColumns: [ticketType.id],
      name: 'emittedTicket_ticketTypeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.ticketGroupId],
      foreignColumns: [ticketGroup.id],
      name: 'emittedTicket_ticketGroupId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const ticketType = pgTable(
  'ticketType',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    price: doublePrecision(),
    maxAvailable: integer().notNull(),
    maxPerPurchase: integer().notNull(),
    category: ticketTypeCategory().notNull(),
    maxSellDate: timestamp({ withTimezone: true, mode: 'string' }),
    visibleInWeb: boolean().default(true).notNull(),
    scanLimit: timestamp({ withTimezone: true, mode: 'string' }),
    eventId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lowStockThreshold: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [event.id],
      name: 'ticketType_eventId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const feature = pgTable(
  'feature',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    key: text().notNull(),
    enabled: boolean().default(false).notNull(),
    value: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('feature_key_key').using(
      'btree',
      table.key.asc().nullsLast().op('text_ops'),
    ),
  ],
);

export const event = pgTable(
  'event',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    coverImageUrl: text().notNull(),
    slug: text().notNull(),
    startingDate: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    endingDate: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    minAge: integer(),
    isDeleted: boolean().default(false).notNull(),
    isActive: boolean().default(false).notNull(),
    locationId: uuid().notNull(),
    categoryId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    inviteCondition: inviteCondition().default('TRADITIONAL').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [location.id],
      name: 'event_locationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [eventCategory.id],
      name: 'event_categoryId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const user = pgTable(
  'user',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    password: text().notNull(),
    email: text().notNull(),
    emailVerified: timestamp({ withTimezone: true, mode: 'string' }),
    image: text(),
    fullName: text().notNull(),
    role: role().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    code: text()
      .default(sql`upper(substr(md5((random())::text), 1, 6))`)
      .notNull(),
  },
  (table) => [
    index('user_code_idx').using(
      'btree',
      table.code.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('user_code_key').using(
      'btree',
      table.code.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('user_email_key').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('user_name_key').using(
      'btree',
      table.name.asc().nullsLast().op('text_ops'),
    ),
  ],
);

export const ticketXrrpp = pgTable(
  'ticketXRRPP',
  {
    ticketGroupId: uuid().primaryKey().notNull(),
    rrppId: uuid().notNull(),
    code: text()
      .default(sql`upper(substr(md5((random())::text), 1, 6))`)
      .notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('ticketXRRPP_code_key').using(
      'btree',
      table.code.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.ticketGroupId],
      foreignColumns: [ticketGroup.id],
      name: 'ticketXRRPP_ticketGroupId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.rrppId],
      foreignColumns: [user.id],
      name: 'ticketXRRPP_rrppId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const tag = pgTable('tag', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
});

export const eventXUser = pgTable(
  '_EVENT_X_USER',
  {
    a: uuid('A').notNull(),
    b: uuid('B').notNull(),
  },
  (table) => [
    index().using('btree', table.b.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.a],
      foreignColumns: [event.id],
      name: '_EVENT_X_USER_A_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.b],
      foreignColumns: [user.id],
      name: '_EVENT_X_USER_B_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({ columns: [table.a, table.b], name: '_EVENT_X_USER_AB_pkey' }),
  ],
);

export const userXTag = pgTable(
  '_USER_X_TAG',
  {
    a: uuid('A').notNull(),
    b: uuid('B').notNull(),
  },
  (table) => [
    index().using('btree', table.b.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.a],
      foreignColumns: [tag.id],
      name: '_USER_X_TAG_A_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.b],
      foreignColumns: [user.id],
      name: '_USER_X_TAG_B_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({ columns: [table.a, table.b], name: '_USER_X_TAG_AB_pkey' }),
  ],
);

export const eventXRrpp = pgTable(
  '_EVENT_X_RRPP',
  {
    a: uuid('A').notNull(),
    b: uuid('B').notNull(),
  },
  (table) => [
    index().using('btree', table.b.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.a],
      foreignColumns: [event.id],
      name: '_EVENT_X_RRPP_A_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.b],
      foreignColumns: [user.id],
      name: '_EVENT_X_RRPP_B_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({ columns: [table.a, table.b], name: '_EVENT_X_RRPP_AB_pkey' }),
  ],
);

export const verificationToken = pgTable(
  'verificationToken',
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: 'verificationToken_pkey',
    }),
  ],
);

export const ticketTypePerGroup = pgTable(
  'ticketTypePerGroup',
  {
    amount: integer().notNull(),
    ticketTypeId: uuid().notNull(),
    ticketGroupId: uuid().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.ticketTypeId],
      foreignColumns: [ticketType.id],
      name: 'ticketTypePerGroup_ticketTypeId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.ticketGroupId],
      foreignColumns: [ticketGroup.id],
      name: 'ticketTypePerGroup_ticketGroupId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({
      columns: [table.ticketTypeId, table.ticketGroupId],
      name: 'ticketTypePerGroup_pkey',
    }),
  ],
);

export const authenticator = pgTable(
  'authenticator',
  {
    credentialId: text().notNull(),
    userId: uuid().notNull(),
    providerAccountId: text().notNull(),
    credentialPublicKey: text().notNull(),
    counter: integer().notNull(),
    credentialDeviceType: text().notNull(),
    credentialBackedUp: boolean().notNull(),
    transports: text(),
  },
  (table) => [
    uniqueIndex('authenticator_credentialID_key').using(
      'btree',
      table.credentialId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'authenticator_userId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({
      columns: [table.credentialId, table.userId],
      name: 'authenticator_pkey',
    }),
  ],
);

export const account = pgTable(
  'account',
  {
    userId: uuid().notNull(),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text(),
    idToken: text('id_token'),
    sessionState: text('session_state'),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'account_userId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({
      columns: [table.provider, table.providerAccountId],
      name: 'account_pkey',
    }),
  ],
);
