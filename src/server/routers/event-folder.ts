import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { event, eventFolder } from '@/drizzle/schema';
import { eventSchema } from '@/server/schemas/event';
import {
  createEventFolderSchema,
  eventFolderSchema,
} from '@/server/schemas/event-folder';
import {
  anyPermissionProcedure,
  permissionProcedure,
  router,
} from '@/server/trpc';

const foldersProcedure = permissionProcedure('events:folders');

export const eventFolderRouter = router({
  getAll: anyPermissionProcedure([
    'events:read',
    'events:folders',
    'events:create',
    'events:update',
  ]).query(async ({ ctx }) => {
    return ctx.db.query.eventFolder.findMany();
  }),
  create: foldersProcedure
    .input(createEventFolderSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(eventFolder).values(input);
    }),
  update: foldersProcedure
    .input(eventFolderSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(eventFolder)
        .set(input)
        .where(eq(eventFolder.id, input.id));
    }),
  delete: foldersProcedure
    .input(eventFolderSchema.shape.id)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(eventFolder).where(eq(eventFolder.id, input));
    }),
  changeFolder: foldersProcedure
    .input(
      z.object({
        eventId: eventSchema.shape.id,
        folderId: eventFolderSchema.shape.id.nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const eventFound = await ctx.db.query.event.findFirst({
        where: eq(event.id, input.eventId),
      });
      if (!eventFound) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Evento no encontrado',
        });
      }
      if (input.folderId !== null) {
        const folderFound = await ctx.db.query.eventFolder.findFirst({
          where: eq(eventFolder.id, input.folderId),
        });
        if (!folderFound) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Carpeta no encontrada',
          });
        }
      }
      return ctx.db
        .update(event)
        .set({ folderId: input.folderId })
        .where(eq(event.id, input.eventId));
    }),
});
