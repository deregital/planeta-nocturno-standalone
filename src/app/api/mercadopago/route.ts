import { mercadoPago } from '@/server/routers/mercado-pago';
import { trpc } from '@/server/trpc/server';
import { Payment } from 'mercadopago';

export async function POST(req: Request) {
  const body: { data: { id: string } } = await req.json();

  const payment = await new Payment(mercadoPago).get({ id: body.data.id });

  if (payment.status === 'approved') {
    // cambiar status de ticketGroup
    if (payment.external_reference) {
      await trpc.ticketGroup.updateStatus({
        id: payment.external_reference,
        status: 'PAID',
      });
    }
    // crear pdf?
    // enviar mail con los pdf?
  }

  return new Response(null, { status: 200 });
}
