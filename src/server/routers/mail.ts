import { publicProcedure, router } from '@/server/trpc';
import z from 'zod';
import { Resend } from 'resend';
import { TRPCError } from '@trpc/server';

const resend = new Resend(process.env.RESEND_API_KEY);

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
      const { data, error } = await resend.emails.send({
        from: `${process.env.NEXT_PUBLIC_INSTANCE_NAME} <ticket@${process.env.RESEND_DOMAIN}>`,
        to: input.receiver,
        subject: input.subject,
        text: input.body,
        attachments: await Promise.all(
          input.attatchments.map(async (pdf) => ({
            content: Buffer.from(await pdf.arrayBuffer()),
            filename: `${process.env.NEXT_PUBLIC_INSTANCE_NAME}-${input.eventName}.pdf`,
            contentType: 'application/pdf',
          })),
        ),
      });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Algo salió mal al enviar el mail',
        });
      }

      return data;
    }),
});
