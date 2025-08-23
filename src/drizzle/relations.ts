import { relations } from 'drizzle-orm/relations';

import {
  user,
  session,
  location,
  event,
  eventCategory,
  ticketType,
  ticketGroup,
  emittedTicket,
  ticketTypePerGroup,
  authenticator,
  account,
} from '@/drizzle/schema';

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  emittedTickets: many(emittedTicket),
  authenticators: many(authenticator),
  accounts: many(account),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
  location: one(location, {
    fields: [event.locationId],
    references: [location.id],
  }),
  eventCategory: one(eventCategory, {
    fields: [event.categoryId],
    references: [eventCategory.id],
  }),
  ticketTypes: many(ticketType),
  ticketGroups: many(ticketGroup),
}));

export const locationRelations = relations(location, ({ many }) => ({
  events: many(event),
}));

export const eventCategoryRelations = relations(eventCategory, ({ many }) => ({
  events: many(event),
}));

export const ticketTypeRelations = relations(ticketType, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketType.eventId],
    references: [event.id],
  }),
  emittedTickets: many(emittedTicket),
  ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const ticketGroupRelations = relations(ticketGroup, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketGroup.eventId],
    references: [event.id],
  }),
  emittedTickets: many(emittedTicket),
  ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const emittedTicketRelations = relations(emittedTicket, ({ one }) => ({
  user: one(user, {
    fields: [emittedTicket.scannedByUserId],
    references: [user.id],
  }),
  ticketType: one(ticketType, {
    fields: [emittedTicket.ticketTypeId],
    references: [ticketType.id],
  }),
  ticketGroup: one(ticketGroup, {
    fields: [emittedTicket.ticketGroupId],
    references: [ticketGroup.id],
  }),
}));

export const ticketTypePerGroupRelations = relations(
  ticketTypePerGroup,
  ({ one }) => ({
    ticketType: one(ticketType, {
      fields: [ticketTypePerGroup.ticketTypeId],
      references: [ticketType.id],
    }),
    ticketGroup: one(ticketGroup, {
      fields: [ticketTypePerGroup.ticketGroupId],
      references: [ticketGroup.id],
    }),
  }),
);

export const authenticatorRelations = relations(authenticator, ({ one }) => ({
  user: one(user, {
    fields: [authenticator.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
