'use server';

import type { Route } from 'next';
import type z from 'zod';

import { differenceInYears, parseISO } from 'date-fns';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { checkFeature } from '@/components/admin/config/checkFeature';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import {
  type CreateManyTicket,
  createManyTicketSchema,
  invitedBySchema,
} from '@/server/schemas/emitted-tickets';
import { trpc } from '@/server/trpc/server';

export type PurchaseActionState = {
  ticketsInput: CreateManyTicket[];
  errors?: string[] | Record<string, string>;
  formData?: Record<string, string>;
};

export const handlePurchase = async (
  prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> => {
  const entradas: Array<
    z.input<typeof createManyTicketSchema>[number] & { id: string }
  > = [];
  const eventId = formData.get('eventId');
  const ticketGroupId = formData.get('ticketGroupId')?.toString() || '';
  const invitedBy = formData.get('invitedBy')?.toString() || '';

  if (!eventId) {
    return {
      ticketsInput: prevState.ticketsInput,
      errors: [
        'El evento no está asignado, vuelva a hacer el proceso desde la home',
      ],
    };
  }

  if (!ticketGroupId) {
    return {
      ticketsInput: prevState.ticketsInput,
      errors: ['Ha ocurrido un error, vuelva a hacer el proceso desde la home'],
    };
  }

  // Capture form data for error handling
  const formDataRecord: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    formDataRecord[key] = value.toString();
  }

  for (const [key, value] of formData.entries()) {
    const [campo, id] = key.split('_');
    if (!campo || !id) continue;

    // Filtrar campos generados automáticamente por react-phone-number-input
    if (id === 'ID' || campo === '$ACTION' || id.endsWith('Country')) continue;
    const entrada = entradas.find((e) => e.id === id);

    const valueString = value.toString();
    if (!entrada) {
      entradas.push({
        id,
        fullName: campo === 'fullName' ? valueString : '',
        dni: campo === 'dni' ? valueString : '',
        mail: campo === 'mail' ? valueString : '',
        birthDate: campo === 'birthDate' ? valueString : '',
        gender: campo === 'gender' ? valueString : 'other',
        phoneNumber: campo === 'phoneNumber' ? valueString : '',
        instagram: campo === 'instagram' ? valueString : '',
        ticketTypeId: campo === 'ticketTypeId' ? valueString : '',
        ticketGroupId: campo === 'ticketGroupId' ? valueString : '',
        paidOnLocation: false,
        eventId: eventId.toString(),
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
        // Para phoneNumber, preferir el valor en formato internacional (que empieza con +)
        if (
          campo === 'phoneNumber' &&
          entradas[index][campo] &&
          !valueString.startsWith('+')
        ) {
          // No sobrescribir si ya tenemos un valor en formato internacional
          continue;
        }
        entradas[index][campo] = valueString;
      }
    }
  }

  const entradaForAll = entradas.find((e) => e.id === 'all-tickets');

  if (entradaForAll) {
    const ticketTypes =
      await trpc.ticketGroup.getTicketTypePerGroupById(ticketGroupId);

    entradas.pop();

    for (const ticketType of ticketTypes) {
      for (let i = 0; i < ticketType.amount; i++) {
        entradas.push({
          id: entradaForAll.id,
          fullName: entradaForAll.fullName,
          dni: entradaForAll.dni,
          mail: entradaForAll.mail,
          birthDate: entradaForAll.birthDate,
          gender: entradaForAll.gender,
          phoneNumber: entradaForAll.phoneNumber,
          instagram: entradaForAll.instagram,
          ticketTypeId: ticketType.ticketTypeId,
          ticketGroupId: ticketGroupId,
          paidOnLocation: false,
          eventId: eventId.toString(),
        });
      }
    }
  }

  await checkFeature(
    FEATURE_KEYS.EXTRA_DATA_CHECKOUT,
    () => {
      const entradaWithMail = entradas.find((e) => e.mail && e.mail !== '');
      if (entradaWithMail) {
        for (const entrada of entradas) {
          entrada.mail = entradaWithMail.mail;
        }
      }
    },
    true,
  );

  const validation = createManyTicketSchema.safeParse(entradas);
  const invitedByValue =
    invitedBy && invitedBy.trim() !== '' ? invitedBy : null;
  const validationInvitedBy = invitedBySchema.safeParse(invitedByValue);

  const errorsArray: Record<string, string> = {};
  // Validar la edad minima del evento
  const event = await trpc.events.getById(eventId.toString());
  if (event.minAge) {
    entradas.forEach((entrada) => {
      if (entrada.birthDate) {
        const birthDate = parseISO(entrada.birthDate.toString());
        const today = new Date();
        const age = differenceInYears(today, birthDate);
        if (event.minAge) {
          if (age < event.minAge) {
            const formKey = `birthDate_${entrada.id}`;
            errorsArray[formKey] =
              `La edad mínima para este evento es ${event.minAge} años`;
          }
        }
      }
    });
  }

  if (!validationInvitedBy.success) {
    errorsArray['invitedBy'] = validationInvitedBy.error.issues[0].message;
  }
  if (!validation.success) {
    // Procesar errores de validación y mapearlos a las keys correctas del formulario
    validation.error.issues.forEach((error: z.core.$ZodIssue) => {
      const path = error.path;
      if (path.length >= 2) {
        const ticketIndex = path[0] as number;
        const fieldName = path[1] as string;

        // Obtener el ticket correspondiente para obtener su ID
        const ticket = entradas[ticketIndex];
        if (ticket) {
          // El ticket.id ya contiene el formato ticketTypeId-idx que necesitamos
          const formKey = `${fieldName}_${ticket.id}`;
          errorsArray[formKey] = error.message;
        }
      }
    });

    return {
      ticketsInput: prevState.ticketsInput,
      errors: errorsArray,
      formData: formDataRecord,
    };
  }

  if (Object.keys(errorsArray).length > 0) {
    return {
      ticketsInput: prevState.ticketsInput,
      errors: errorsArray,
      formData: formDataRecord,
    };
  }

  const totalPrice = await trpc.ticketGroup.getTotalPriceById(
    ticketGroupId?.toString() ?? '',
  );

  await trpc.emittedTickets.createMany(entradas);

  // Actualizar el organizador asociado al ticketGroup solo si hay un código válido
  if (invitedBy && invitedBy.trim() !== '') {
    await trpc.ticketGroup.updateInvitedBy({
      id: ticketGroupId,
      invitedBy,
    });
  }

  const firstTicket = {
    fullName: entradas[0].fullName,
    dni: entradas[0].dni,
    mail: entradas[0].mail,
    gender: entradas[0].gender,
    phoneNumber: entradas[0].phoneNumber,
    instagram: entradas[0].instagram,
    birthDate: entradas[0].birthDate,
  };

  if (totalPrice === 0) {
    await trpc.ticketGroup.updateStatus({
      id: ticketGroupId,
      status: 'FREE',
    });

    const group = await trpc.ticketGroup.getById(ticketGroupId);

    const pdfs =
      await trpc.ticketGroup.generatePdfsByTicketGroupId(ticketGroupId);

    // Enviar emails de forma secuencial para evitar rate limits
    try {
      // Enviar un solo mail con todas las entradas si extraTicketData = false o si la feature EXTRA_DATA_CHECKOUT está desactivada
      if (
        !group.event.extraTicketData ||
        (await checkFeature(FEATURE_KEYS.EXTRA_DATA_CHECKOUT, () => true, true))
      ) {
        await trpc.mail.send({
          eventName: group.event.name,
          receiver: entradas[0].mail,
          subject: `¡Llegaron tus tickets para ${group.event.name}!`,
          body: `Te esperamos.`,
          attatchments: pdfs.map((pdf) => pdf.pdf.blob),
        });
      } else {
        for (const pdf of pdfs) {
          await trpc.mail.send({
            eventName: group.event.name,
            receiver: pdf.ticket.mail,
            subject: `¡Llegaron tus tickets para ${group.event.name}!`,
            body: `Te esperamos.`,
            attatchments: [pdf.pdf.blob],
          });
        }
      }
    } catch (error) {
      console.error(error);
      return {
        ticketsInput: prevState.ticketsInput,
        errors: ['Error al enviar los emails, vuelva a intentarlo'],
        formData: formDataRecord,
      };
    }

    await checkFeature(FEATURE_KEYS.EMAIL_NOTIFICATION, async () => {
      await trpc.mail.sendNotification({
        eventName: group.event.name,
        ticketGroupId,
      });
    });

    (await cookies()).set('lastPurchase', JSON.stringify(firstTicket));
    (await cookies()).delete('carrito');

    redirect(`/tickets/${ticketGroupId}`);
  } else {
    const url = await trpc.mercadoPago.createPreference({ ticketGroupId });

    if (!url) {
      return {
        ticketsInput: prevState.ticketsInput,
        errors: ['Error al crear la preferencia de pago, vuelva a intentarlo'],
        formData: formDataRecord,
      };
    }

    (await cookies()).set('lastPurchase', JSON.stringify(firstTicket));
    (await cookies()).delete('carrito');

    redirect(url as Route);
  }
};
