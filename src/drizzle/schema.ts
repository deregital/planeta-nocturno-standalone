import { pgTable, uniqueIndex, foreignKey, text, uuid, timestamp, integer, boolean, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const role = pgEnum("Role", ['ADMIN', 'STAFF'])


export const session = pgTable("session", {
	sessionToken: text().notNull(),
	userId: uuid().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("session_sessionToken_key").using("btree", table.sessionToken.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const user = pgTable("user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	password: text().notNull(),
	email: text().notNull(),
	emailVerified: timestamp({ withTimezone: true, mode: 'string' }),
	image: text(),
	fullName: text().notNull(),
	role: role().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("user_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const event = pgTable("event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	coverImageUrl: text().notNull(),
	slug: text().notNull(),
	startingDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endingDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	minAge: integer(),
	locationId: uuid().notNull(),
	categoryId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [location.id],
			name: "event_locationId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [eventCategory.id],
			name: "event_categoryId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const eventCategory = pgTable("eventCategory", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emmitedTicket = pgTable("emmitedTicket", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fullName: text().notNull(),
	age: integer().notNull(),
	dni: text().notNull(),
	mail: text().notNull(),
	phoneNumber: text().notNull(),
	instagram: text(),
	birthDate: text().notNull(),
	paidOnLocation: boolean().notNull(),
	scanned: boolean().default(false).notNull(),
	scannedAt: timestamp({ precision: 3, mode: 'string' }),
	scannedByUserId: uuid().notNull(),
	eventId: uuid().notNull(),
	ticketTypeId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("emmitedTicket_dni_key").using("btree", table.dni.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.scannedByUserId],
			foreignColumns: [user.id],
			name: "emmitedTicket_scannedByUserId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "emmitedTicket_eventId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.ticketTypeId],
			foreignColumns: [ticketType.id],
			name: "emmitedTicket_ticketTypeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const location = pgTable("location", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	adress: text().notNull(),
	googleMapsUrl: text().notNull(),
	capacity: integer().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const ticketType = pgTable("ticketType", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	price: doublePrecision(),
	maxAvailable: integer().notNull(),
	maxPerPurchase: integer().notNull(),
	scanLimit: timestamp({ precision: 3, mode: 'string' }),
	eventId: uuid().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "ticketType_eventId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const verificationToken = pgTable("verificationToken", {
	identifier: text().notNull(),
	token: text().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.identifier, table.token], name: "verificationToken_pkey"}),
]);

export const authenticator = pgTable("authenticator", {
	credentialId: text().notNull(),
	userId: uuid().notNull(),
	providerAccountId: text().notNull(),
	credentialPublicKey: text().notNull(),
	counter: integer().notNull(),
	credentialDeviceType: text().notNull(),
	credentialBackedUp: boolean().notNull(),
	transports: text(),
}, (table) => [
	uniqueIndex("authenticator_credentialID_key").using("btree", table.credentialId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "authenticator_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.credentialId, table.userId], name: "authenticator_pkey"}),
]);

export const account = pgTable("account", {
	userId: uuid().notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	providerAccountId: text().notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.provider, table.providerAccountId], name: "account_pkey"}),
]);
