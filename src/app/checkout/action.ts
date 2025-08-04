'use server';
import { createManyTicketSchema } from '@/server/routers/emitted-tickets';
import { trpc } from '@/server/trpc/server';
import { redirect } from 'next/navigation';
import type z from 'zod';

export const handlePurchase = async (
  // prevState: unknown,
  formData: FormData,
) => {
  const entradas: z.infer<typeof createManyTicketSchema> = [];
  const eventId = formData.get('eventId');
  const ticketGroupId = formData.get('ticketGroupId')?.toString() || '';

  for (const [key, value] of formData.entries()) {
    const [campo, id] = key.split('_');
    if (!campo || !id) continue;

    if (id === 'ID') continue;
    const entrada = entradas.find((e) => e.id === id);

    if (!entrada) {
      entradas.push({
        id,
        fullName: campo === 'fullName' ? value.toString() : '',
        dni: campo === 'dni' ? value.toString() : '',
        mail: campo === 'mail' ? value.toString() : '',
        birthDate: campo === 'birthDate' ? value.toString() : '',
        gender: campo === 'gender' ? value.toString() : '',
        phoneNumber: campo === 'phoneNumber' ? value.toString() : '',
        instagram: campo === 'instagram' ? value.toString() : '',
        ticketTypeId: campo === 'ticketTypeId' ? value.toString() : '',
        ticketGroupId: campo === 'ticketGroupId' ? value.toString() : '',
        eventId: eventId?.toString() ?? null,
      });
    } else {
      if (
        campo === 'fullName' ||
        campo === 'dni' ||
        campo === 'mail' ||
        campo === 'birthDate' ||
        campo === 'phoneNumber' ||
        campo === 'instagram' ||
        campo === 'ticketTypeId' ||
        campo === 'ticketGroupId' ||
        campo === 'gender'
      ) {
        const index = entradas.findIndex((e) => e.id === id);
        entradas[index][campo] = value.toString();
      }
    }
  }

  const validation = createManyTicketSchema.safeParse(entradas);

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const totalPrice = await trpc.ticketGroup.getTotalPriceById(
    ticketGroupId?.toString() ?? '',
  );

  await trpc.emittedTickets.createMany(entradas);
  if (totalPrice === 0) {
    await trpc.ticketGroup.updateStatus({
      id: ticketGroupId,
      status: 'FREE',
    });
    const group = await trpc.ticketGroup.getById(ticketGroupId);

    const pdfs =
      await trpc.ticketGroup.generatePdfsByTicketGroupId(ticketGroupId);

    // enviar mail con los pdf?
    await Promise.all(
      pdfs.map(async (pdf) =>
        trpc.mail.send({
          eventName: group.event.name,
          receiver: pdf.ticket.mail,
          subject: `Llegaron tus tickets para ${group.event.name}!`,
          body: `Te esperamos eAAAAAAAAAAAAAAAAAAA`,
          attatchments: [pdf.pdf],
        }),
      ),
    );
  } else {
    const url = await trpc.mercadoPago.createPreference({ ticketGroupId });
    if (url) {
      redirect(url);
    } else {
      throw new Error('Error al crear la preferencia de pago');
    }
  }
};
