import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { event, eventFolder } from '@/drizzle/schema';
import { eventSchema } from '@/server/schemas/event';
import {
  createEventFolderSchema,
  eventFolderSchema,
} from '@/server/schemas/event-folder';
import { adminProcedure, router } from '@/server/trpc';

export const eventFolderRouter = router({
  getAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.eventFolder.findMany();
  }),
  create: adminProcedure
    .input(createEventFolderSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(eventFolder).values(input);
    }),
  update: adminProcedure
    .input(eventFolderSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(eventFolder)
        .set(input)
        .where(eq(eventFolder.id, input.id));
    }),
  delete: adminProcedure
    .input(eventFolderSchema.shape.id)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(eventFolder).where(eq(eventFolder.id, input));
    }),
  changeFolder: adminProcedure
    .input(
      z.object({
        eventId: eventSchema.shape.id,
        folderId: eventFolderSchema.shape.id,
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
      const folderFound = await ctx.db.query.eventFolder.findFirst({
        where: eq(eventFolder.id, input.folderId),
      });
      if (!folderFound) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Carpeta no encontrada',
        });
      }
      return ctx.db
        .update(event)
        .set({ folderId: input.folderId })
        .where(eq(event.id, input.eventId));
    }),
});
