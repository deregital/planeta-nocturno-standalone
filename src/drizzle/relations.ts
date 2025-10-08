import { relations } from 'drizzle-orm/relations';
import {
  user,
  session,
  event,
  ticketGroup,
  emittedTicket,
  ticketType,
  location,
  eventCategory,
  ticketXrrpp,
  eventXUser,
  tag,
  userXTag,
  eventXRrpp,
  ticketTypePerGroup,
  authenticator,
  account,
} from './schema';

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  emittedTickets: many(emittedTicket),
  ticketXrrpps: many(ticketXrrpp),
  eventXUsers: many(eventXUser),
  userXTags: many(userXTag),
  eventXRrpps: many(eventXRrpp),
  authenticators: many(authenticator),
  accounts: many(account),
}));

export const ticketGroupRelations = relations(ticketGroup, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketGroup.eventId],
    references: [event.id],
  }),
  emittedTickets: many(emittedTicket),
  ticketXrrpps: many(ticketXrrpp),
  ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
  ticketGroups: many(ticketGroup),
  ticketTypes: many(ticketType),
  location: one(location, {
    fields: [event.locationId],
    references: [location.id],
  }),
  eventCategory: one(eventCategory, {
    fields: [event.categoryId],
    references: [eventCategory.id],
  }),
  eventXUsers: many(eventXUser),
  eventXRrpps: many(eventXRrpp),
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

export const ticketTypeRelations = relations(ticketType, ({ one, many }) => ({
  emittedTickets: many(emittedTicket),
  event: one(event, {
    fields: [ticketType.eventId],
    references: [event.id],
  }),
  ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const locationRelations = relations(location, ({ many }) => ({
  events: many(event),
}));

export const eventCategoryRelations = relations(eventCategory, ({ many }) => ({
  events: many(event),
}));

export const ticketXrrppRelations = relations(ticketXrrpp, ({ one }) => ({
  ticketGroup: one(ticketGroup, {
    fields: [ticketXrrpp.ticketGroupId],
    references: [ticketGroup.id],
  }),
  user: one(user, {
    fields: [ticketXrrpp.rrppId],
    references: [user.id],
  }),
}));

export const eventXUserRelations = relations(eventXUser, ({ one }) => ({
  event: one(event, {
    fields: [eventXUser.a],
    references: [event.id],
  }),
  user: one(user, {
    fields: [eventXUser.b],
    references: [user.id],
  }),
}));

export const userXTagRelations = relations(userXTag, ({ one }) => ({
  tag: one(tag, {
    fields: [userXTag.a],
    references: [tag.id],
  }),
  user: one(user, {
    fields: [userXTag.b],
    references: [user.id],
  }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  userXTags: many(userXTag),
}));

export const eventXRrppRelations = relations(eventXRrpp, ({ one }) => ({
  event: one(event, {
    fields: [eventXRrpp.a],
    references: [event.id],
  }),
  user: one(user, {
    fields: [eventXRrpp.b],
    references: [user.id],
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
