'use server';
import { createManyTicketSchema } from '@/server/routers/emitted-tickets';
import { trpc } from '@/server/trpc/server';
import type z from 'zod';

export const handlePurchase = async (formData: FormData) => {
  const entradas: z.infer<typeof createManyTicketSchema> = [];
  const eventId = formData.get('eventId');

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
  console.log('validation:', validation);

  // Validar DNI únicos
  const dnis = new Set<string>();
  for (const entrada of entradas) {
    if (dnis.has(entrada.dni)) {
      throw new Error(`DNI duplicado: ${entrada.dni}`);
    }
    dnis.add(entrada.dni);
  }

  if (validation) {
    await trpc.emittedTickets.createMany(entradas);
  }
  console.log('entradas:', entradas);
  console.log('entradas:', entradas.length);
};
