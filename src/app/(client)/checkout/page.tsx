'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import CheckoutClient from '@/app/(client)/checkout/client';
import { trpc } from '@/server/trpc/server';

export default async function CheckoutPage() {
  const ticketGroupId = (await cookies()).get('carrito');

  if (!ticketGroupId) {
    redirect('/');
  }

  const data = await trpc.ticketGroup.getById(ticketGroupId.value);

  return <CheckoutClient ticketGroup={data} />;
}
