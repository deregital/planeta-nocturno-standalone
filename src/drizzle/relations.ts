import { relations } from 'drizzle-orm/relations';
import {
  user,
  session,
  event,
  ticketGroup,
  ticketType,
  emittedTicket,
  location,
  eventCategory,
  ticketXorganizer,
  eventXUser,
  tag,
  userXTag,
  ticketTypePerGroup,
  eventXorganizer,
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
  ticketXorganizers: many(ticketXorganizer),
  eventXUsers: many(eventXUser),
  userXTags: many(userXTag),
  eventXorganizers: many(eventXorganizer),
  authenticators: many(authenticator),
  accounts: many(account),
}));

export const ticketGroupRelations = relations(ticketGroup, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketGroup.eventId],
    references: [event.id],
  }),
  emittedTickets: many(emittedTicket),
  ticketXorganizers: many(ticketXorganizer),
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
  eventXorganizers: many(eventXorganizer),
}));

export const ticketTypeRelations = relations(ticketType, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketType.eventId],
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

export const locationRelations = relations(location, ({ many }) => ({
  events: many(event),
}));

export const eventCategoryRelations = relations(eventCategory, ({ many }) => ({
  events: many(event),
}));

export const ticketXorganizerRelations = relations(
  ticketXorganizer,
  ({ one }) => ({
    ticketGroup: one(ticketGroup, {
      fields: [ticketXorganizer.ticketGroupId],
      references: [ticketGroup.id],
    }),
    user: one(user, {
      fields: [ticketXorganizer.organizerId],
      references: [user.id],
    }),
  }),
);

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

export const eventXorganizerRelations = relations(
  eventXorganizer,
  ({ one }) => ({
    event: one(event, {
      fields: [eventXorganizer.eventId],
      references: [event.id],
    }),
    user: one(user, {
      fields: [eventXorganizer.organizerId],
      references: [user.id],
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
