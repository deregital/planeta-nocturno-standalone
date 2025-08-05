'use server';
import { createManyTicketSchema } from '@/server/schemas/emitted-tickets';
import { trpc } from '@/server/trpc/server';
import { redirect } from 'next/navigation';
import type z from 'zod';

export type PurchaseActionState = {
  ticketsInput: z.infer<typeof createManyTicketSchema>[];
  errors?: string[];
};

export const handlePurchase = async (
  prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> => {
  const entradas: z.infer<typeof createManyTicketSchema> = [];
  const eventId = formData.get('eventId');
  const ticketGroupId = formData.get('ticketGroupId')?.toString() || '';

  if (!eventId || !ticketGroupId) {
    return {
      ticketsInput: prevState.ticketsInput,
      errors: [
        'El evento no está asignado, vuelva a hacer el proceso desde la home',
      ],
    };
  }

  // REFORMULAR
  for (const [key, value] of formData.entries()) {
    const [campo, id] = key.split('_');
    if (!campo || !id) continue;

    if (id === 'ID' || campo === '$ACTION') continue;
    const entrada = entradas.find((e) => e.id === id);

    if (!entrada) {
      entradas.push({
        id,
        fullName: campo === 'fullName' ? value.toString() : '',
        dni: campo === 'dni' ? value.toString() : '',
        mail: campo === 'mail' ? value.toString() : '',
        birthDate: campo === 'birthDate' ? value.toString() : '',
        gender: campo === 'gender' ? value.toString() : 'other',
        phoneNumber: campo === 'phoneNumber' ? value.toString() : '',
        instagram: campo === 'instagram' ? value.toString() : '',
        ticketTypeId: campo === 'ticketTypeId' ? value.toString() : '',
        ticketGroupId: campo === 'ticketGroupId' ? value.toString() : '',
        paidOnLocation: false,
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
      ticketsInput: prevState.ticketsInput,
      errors: validation.error.flatten().fieldErrors[0],
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

    await Promise.all(
      pdfs.map(async (pdf) =>
        trpc.mail.send({
          eventName: group.event.name,
          receiver: pdf.ticket.mail,
          subject: `Llegaron tus tickets para ${group.event.name}!`,
          body: `Te esperamos.`,
          attatchments: [pdf.pdf.blob],
        }),
      ),
    );

    redirect(`/tickets/${ticketGroupId}`);
  } else {
    const url = await trpc.mercadoPago.createPreference({ ticketGroupId });

    if (!url) {
      return {
        ticketsInput: prevState.ticketsInput,
        errors: ['Error al crear la preferencia de pago, vuelva a intentarlo'],
      };
    }

    redirect(url);
  }
};
