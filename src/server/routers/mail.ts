import { publicProcedure, router } from '@/server/trpc';
import z from 'zod';
import { TRPCError } from '@trpc/server';
import { sendMail } from '../services/mail';

export const mailRouter = router({
  send: publicProcedure
    .input(
      z.object({
        eventName: z.string(),
        receiver: z.email(),
        subject: z.string(),
        body: z.string(),
        attatchments: z.instanceof(Blob).array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await sendMail({
        to: input.receiver,
        subject: input.subject,
        body: input.body,
        attachments: await Promise.all(
          input.attatchments.map(async (pdf) =>
            Buffer.from(await pdf.arrayBuffer()),
          ),
        ),
        eventName: input.eventName,
      });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Algo salió mal al enviar el mail',
          cause: error,
        });
      }

      return data;
    }),
});
