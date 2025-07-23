import { relations } from "drizzle-orm/relations";
import { location, event, eventCategory, ticketType, ticketGroup, emmitedTicket, user, session, ticketTypePerGroup, authenticator, account } from "./schema";

export const eventRelations = relations(event, ({one, many}) => ({
	location: one(location, {
		fields: [event.locationId],
		references: [location.id]
	}),
	eventCategory: one(eventCategory, {
		fields: [event.categoryId],
		references: [eventCategory.id]
	}),
	ticketTypes: many(ticketType),
	ticketGroups: many(ticketGroup),
}));

export const locationRelations = relations(location, ({many}) => ({
	events: many(event),
}));

export const eventCategoryRelations = relations(eventCategory, ({many}) => ({
	events: many(event),
}));

export const ticketTypeRelations = relations(ticketType, ({one, many}) => ({
	event: one(event, {
		fields: [ticketType.eventId],
		references: [event.id]
	}),
	emmitedTickets: many(emmitedTicket),
	ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const ticketGroupRelations = relations(ticketGroup, ({one, many}) => ({
	event: one(event, {
		fields: [ticketGroup.eventId],
		references: [event.id]
	}),
	emmitedTickets: many(emmitedTicket),
	ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const emmitedTicketRelations = relations(emmitedTicket, ({one}) => ({
	ticketType: one(ticketType, {
		fields: [emmitedTicket.ticketTypeId],
		references: [ticketType.id]
	}),
	ticketGroup: one(ticketGroup, {
		fields: [emmitedTicket.ticketGroupId],
		references: [ticketGroup.id]
	}),
	user: one(user, {
		fields: [emmitedTicket.scannedByUserId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	emmitedTickets: many(emmitedTicket),
	sessions: many(session),
	authenticators: many(authenticator),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const ticketTypePerGroupRelations = relations(ticketTypePerGroup, ({one}) => ({
	ticketType: one(ticketType, {
		fields: [ticketTypePerGroup.ticketTypeId],
		references: [ticketType.id]
	}),
	ticketGroup: one(ticketGroup, {
		fields: [ticketTypePerGroup.ticketGroupId],
		references: [ticketGroup.id]
	}),
}));

export const authenticatorRelations = relations(authenticator, ({one}) => ({
	user: one(user, {
		fields: [authenticator.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));