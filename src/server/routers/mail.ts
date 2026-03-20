import { TRPCError } from '@trpc/server';
import z from 'zod';

import { sendMailService } from '@/server/services/mail';
import { sendNotificationService } from '@/server/services/notification';
import { adminProcedure, router, ticketingProcedure } from '@/server/trpc';

export const mailRouter = router({
  send: ticketingProcedure
    .input(
      z.object({
        eventName: z.string(),
        receiver: z.email(),
        subject: z.string(),
        body: z.string(),
        attatchments: z.instanceof(Blob).array(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await sendMailService({
          eventName: input.eventName,
          receiver: input.receiver,
          subject: input.subject,
          body: input.body,
          attatchments: input.attatchments,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Algo salió mal al enviar el mail',
          cause: error,
        });
      }
    }),
  sendNotification: adminProcedure
    .input(
      z.object({
        eventName: z.string(),
        ticketGroupId: z.string(),
        email: z.email(),
      }),
    )
    .mutation(async ({ input }) => {
      await sendNotificationService({
        eventName: input.eventName,
        ticketGroupId: input.ticketGroupId,
        email: input.email,
      });
    }),
});
