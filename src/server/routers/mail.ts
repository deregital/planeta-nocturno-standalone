import z from 'zod';
import { TRPCError } from '@trpc/server';

import { publicProcedure, router } from '@/server/trpc';
import { sendMail } from '@/server/services/mail';

// Función de retry para manejar rate limits
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error: unknown) {
      lastError = error;

      // Verificar si es un error 429 (rate limit) de diferentes formas posibles
      const isRateLimit =
        (error as { status?: number })?.status === 429 ||
        (error as { response?: { status?: number } })?.response?.status ===
          429 ||
        (error as { statusCode?: number })?.statusCode === 429 ||
        (error as { code?: number })?.code === 429 ||
        (error as { message?: string })?.message?.includes('rate limit') ||
        (error as { message?: string })?.message?.includes('429') ||
        (error as { message?: string })?.message
          ?.toLowerCase()
          .includes('too many requests');

      if (!isRateLimit) {
        throw error;
      }

      // Si es rate limit pero ya no tenemos más intentos, lanzar el error
      if (attempt >= maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

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
      const attachments = await Promise.all(
        input.attatchments.map(async (pdf) =>
          Buffer.from(await pdf.arrayBuffer()),
        ),
      );

      try {
        const result = await retryWithBackoff(
          async () =>
            await sendMail({
              to: input.receiver,
              subject: input.subject,
              body: input.body,
              attachments,
              eventName: input.eventName,
            }),
          3, // 3 intentos máximo
          1000, // 1 segundo de delay
        );

        const { data, error } = result;

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Algo salió mal al enviar el mail',
            cause: error,
          });
        }

        return data;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Algo salió mal al enviar el mail',
          cause: error,
        });
      }
    }),
});
