import { eq } from 'drizzle-orm';

import { eventXorganizer } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';

export const organizerRouter = router({
  getMyEvents: publicProcedure.query(async ({ ctx }) => {
    const myEventsRelation = await ctx.db.query.eventXorganizer.findMany({
      where: eq(eventXorganizer.organizerId, ctx.session?.user?.id ?? ''),
      with: {
        event: {
          with: {
            ticketTypes: true,
            location: true,
          },
        },
      },
    });
    return myEventsRelation;
  }),
});
