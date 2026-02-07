'use server';

import { type RouterInputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/server';

export async function emitTicket(
  ticket: RouterInputs['emittedTickets']['create'],
) {
  const ticketCreated = await trpc.emittedTickets.create(ticket);
  const pdfs = await trpc.ticketGroup.generatePdfsByTicketGroupId(
    ticketCreated.ticketGroupId,
  );
  const pdf = pdfs.find((p) => p.ticket.id === ticketCreated.id) ?? pdfs[0];

  const event = await trpc.events.getById(ticket.eventId);

  try {
    await trpc.mail.send({
      eventName: event.name,
      receiver: pdf.ticket.mail,
      subject: `Llegaron tus tickets para ${event.name}!`,
      body: 'Te esperamos.',
      attatchments: [pdf.pdf.blob],
    });
  } catch (error) {
    console.error('Error al emitir el ticket y enviar el mail', error);
  }
}

export async function downloadTicket(ticketId: string) {
  const result = await trpc.emittedTickets.getPdf({ ticketId });
  return result;
}
