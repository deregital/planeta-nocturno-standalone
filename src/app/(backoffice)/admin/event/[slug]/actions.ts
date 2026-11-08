'use server';

import { TRPCError } from '@trpc/server';

import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { logger } from '@/server/observability/logger';
import { type RouterInputs } from '@/server/routers/app';
import { generateTicketEmailBody } from '@/server/services/mail';
import { trpc } from '@/server/trpc/server';

export type EmitTicketResult =
  | { ok: true }
  | { ok: false; overQuota: boolean; message: string };

export async function emitTicket(
  ticket: RouterInputs['emittedTickets']['create'],
): Promise<EmitTicketResult> {
  let ticketCreated;
  try {
    ticketCreated = await trpc.emittedTickets.create(ticket);
  } catch (error) {
    // Antes el error subía sin capturar y el modal quedaba cargando.
    if (error instanceof TRPCError && error.code !== 'INTERNAL_SERVER_ERROR') {
      return {
        ok: false,
        overQuota: error.code === 'CONFLICT',
        message: error.message,
      };
    }
    logger.error('Manual ticket emission failed', {
      eventId: ticket.eventId,
      error,
    });
    return {
      ok: false,
      overQuota: false,
      message: 'No se pudo emitir el ticket. Intentá de nuevo.',
    };
  }

  const pdfs = await trpc.ticketGroup.generatePdfsByTicketGroupId(
    ticketCreated.ticketGroupId,
  );
  const pdf = pdfs.find((p) => p.ticket.id === ticketCreated.id) ?? pdfs[0];

  const event = await trpc.events.getById(ticket.eventId);
  const { instance } = await getCurrentRequestContext();

  try {
    await trpc.mail.send({
      eventName: event.name,
      receiver: pdf.ticket.mail,
      subject: `Llegaron tus tickets para ${event.name}!`,
      body: generateTicketEmailBody(instance, event.name),
      attatchments: [pdf.pdf.blob],
    });
  } catch (error) {
    logger.error('Unable to send emitted ticket email', {
      ticketGroupId: ticketCreated.ticketGroupId,
      eventId: ticket.eventId,
      error,
    });
  }
  return { ok: true };
}

export async function downloadTicket(ticketId: string) {
  const result = await trpc.emittedTickets.getPdf({ ticketId });
  return result;
}
