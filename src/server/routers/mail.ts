import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { ticketGroup as ticketGroupSchema, user } from '@/drizzle/schema';
import { sendMail, sendMailWithoutAttachments } from '@/server/services/mail';
import { calculateTotalPrice } from '@/server/services/ticketGroup';
import { publicProcedure, router } from '@/server/trpc';

// Función de retry para manejar rate limits
export async function retryWithBackoff<T>(
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
          2000, // 1 segundo de delay
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
  sendNotification: publicProcedure
    .input(
      z.object({
        eventName: z.string(),
        ticketGroupId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { eventName, ticketGroupId } = input;

      const ticketGroup = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroupSchema.id, ticketGroupId),
        with: {
          ticketTypePerGroups: {
            with: {
              ticketType: {
                columns: {
                  name: true,
                },
              },
            },
          },
        },
      });

      const admins = await ctx.db.query.user.findMany({
        where: eq(user.role, 'ADMIN'),
      });

      // No deberia ser posible
      if (!admins) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se encontró el administrador',
        });
      }

      const totalPrice = await calculateTotalPrice({
        ticketGroupId: input.ticketGroupId,
      });

      const ticketTypeText = ticketGroup?.ticketTypePerGroups
        .map(
          (ticketType) =>
            `${ticketType.amount} entradas de ${ticketType.ticketType.name}`,
        )
        .join(', ');
      const bodyText = `Se han vendido entradas para ${eventName}. ${ticketTypeText}. El monto total recaudado es de $${totalPrice}. Para más información, ingresá a la plataforma.`;

      try {
        for (const admin of admins) {
          const result = await retryWithBackoff(
            async () =>
              await sendMailWithoutAttachments({
                to: admin.email,
                subject: `Entrada vendida - ${eventName}`,
                body: bodyText,
              }),
            3, // 3 intentos máximo
            1000, // 1 segundo de delay
          );

          if (result.error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Algo salió mal al enviar el mail a ${admin.email} para la notificación de ${bodyText}`,
              cause: result.error,
            });
          }
        }
      } catch (error) {
        console.error(error);
      }
    }),
});
