'use server';

import { type RouterInputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/server';

export async function emitTicket(
  ticket: RouterInputs['emittedTickets']['create'],
) {
  const ticketCreated = await trpc.emittedTickets.create(ticket);
  const [pdf] = await trpc.ticketGroup.generatePdfsByTicketGroupId(
    ticketCreated.ticketGroupId,
  );

  const event = await trpc.events.getById(ticket.eventId);

  await trpc.mail.send({
    eventName: event.name,
    receiver: pdf.ticket.mail,
    subject: `Llegaron tus tickets para ${event.name}!`,
    body: 'Te esperamos.',
    attatchments: [pdf.pdf.blob],
  });
}
