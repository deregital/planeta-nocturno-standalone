import { relations } from 'drizzle-orm/relations';
import {
  event,
  ticketType,
  user,
  emittedTicket,
  ticketGroup,
  session,
  location,
  eventCategory,
  eventXUser,
  tag,
  userXTag,
  ticketTypePerGroup,
  eventXorganizer,
  ticketXorganizer,
  authenticator,
  account,
} from './schema';

export const ticketTypeRelations = relations(ticketType, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketType.eventId],
    references: [event.id],
  }),
  emittedTickets: many(emittedTicket),
  ticketTypePerGroups: many(ticketTypePerGroup),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
  ticketTypes: many(ticketType),
  emittedTickets: many(emittedTicket),
  ticketGroups: many(ticketGroup),
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
  ticketXorganizers: many(ticketXorganizer),
}));

export const emittedTicketRelations = relations(
  emittedTicket,
  ({ one, many }) => ({
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
    event: one(event, {
      fields: [emittedTicket.eventId],
      references: [event.id],
    }),
    ticketXorganizers: many(ticketXorganizer),
  }),
);

export const userRelations = relations(user, ({ many }) => ({
  emittedTickets: many(emittedTicket),
  ticketGroups: many(ticketGroup),
  sessions: many(session),
  eventXUsers: many(eventXUser),
  userXTags: many(userXTag),
  eventXorganizers: many(eventXorganizer),
  ticketXorganizers: many(ticketXorganizer),
  authenticators: many(authenticator),
  accounts: many(account),
}));

export const ticketGroupRelations = relations(ticketGroup, ({ one, many }) => ({
  emittedTickets: many(emittedTicket),
  event: one(event, {
    fields: [ticketGroup.eventId],
    references: [event.id],
  }),
  user: one(user, {
    fields: [ticketGroup.invitedById],
    references: [user.id],
  }),
  ticketTypePerGroups: many(ticketTypePerGroup),
  ticketXorganizers: many(ticketXorganizer),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const locationRelations = relations(location, ({ many }) => ({
  events: many(event),
}));

export const eventCategoryRelations = relations(eventCategory, ({ many }) => ({
  events: many(event),
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

export const ticketXorganizerRelations = relations(
  ticketXorganizer,
  ({ one }) => ({
    emittedTicket: one(emittedTicket, {
      fields: [ticketXorganizer.ticketId],
      references: [emittedTicket.id],
    }),
    user: one(user, {
      fields: [ticketXorganizer.organizerId],
      references: [user.id],
    }),
    ticketGroup: one(ticketGroup, {
      fields: [ticketXorganizer.ticketGroupId],
      references: [ticketGroup.id],
    }),
    event: one(event, {
      fields: [ticketXorganizer.eventId],
      references: [event.id],
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
