'use server';

import { TRPCError } from '@trpc/server';
import { type Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import CheckoutClient from '@/app/(client)/checkout/client';
import ServerErrorCard from '@/components/common/ServerErrorCard';
import { type EmittedTicketInput } from '@/server/schemas/emitted-tickets';
import { trpc } from '@/server/trpc/server';

export default async function CheckoutPage() {
  const ticketGroupId = (await cookies()).get('carrito');
  const lastPurchase: EmittedTicketInput = JSON.parse(
    (await cookies()).get('lastPurchase')?.value ?? '{}',
  );

  if (!ticketGroupId) {
    redirect('/');
  }

  // Con la cookie de una reserva que ya se borró se veía "Algo salió mal" y
  // "Intentar nuevamente" volvía a fallar siempre.
  const data = await trpc.ticketGroup
    .getById(ticketGroupId.value)
    .catch((error: unknown) => {
      if (
        error instanceof TRPCError &&
        (error.code === 'NOT_FOUND' || error.code === 'BAD_REQUEST')
      ) {
        return null;
      }
      throw error;
    });

  // Una reserva de Mercado Pago vencida conserva el grupo pero ya no el cupo.
  if (!data || data.ticketTypePerGroups.length === 0) {
    return (
      <ServerErrorCard
        title='Tu reserva ya no está activa'
        description='Pasaron más de 10 minutos o, si es una invitación, el link se abrió en otro dispositivo. Volvé a abrir el link o elegí tus entradas de nuevo.'
        route='/'
      />
    );
  }

  if (data.status !== 'BOOKED') {
    redirect(`/tickets/${data.id}` as Route);
  }

  return <CheckoutClient ticketGroup={data} lastPurchase={lastPurchase} />;
}
