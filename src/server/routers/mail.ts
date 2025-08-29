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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Debug: imprimir el error completo para entender su estructura
      console.log(
        'Error caught in retry logic:',
        JSON.stringify(error, null, 2),
      );
      console.log('Error type:', typeof error);
      console.log('Error keys:', Object.keys(error as object));

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

      console.log('Is rate limit detected:', isRateLimit);

      if (isRateLimit && attempt < maxRetries) {
        console.log(
          `Rate limit reached, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Si no es un error 429 o ya no tenemos más intentos, lanzar el error
      throw error;
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

      const result = await retryWithBackoff(
        async () =>
          await sendMail({
            to: input.receiver,
            subject: input.subject,
            body: input.body,
            attachments,
            eventName: input.eventName,
          }),
        3, // 3 reintentos
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
    }),
});
