'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import GoBack from '@/components/common/GoBack';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/server/trpc/client';

const POLL_INTERVAL_MS = 3000;

export default function TicketsWaitingClient({
  ticketGroupId,
}: {
  ticketGroupId: string;
}) {
  const router = useRouter();

  const { data } = trpc.ticketGroup.getStatus.useQuery(ticketGroupId, {
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (data && data.status !== 'BOOKED') {
      router.refresh();
    }
  }, [data, router]);

  return (
    <div className='flex justify-center items-center h-full'>
      <GoBack
        route='/'
        title='Volver al inicio'
        className='absolute top-24 md:left-26 left-4'
      />
      <Card className='max-w-md mx-auto text-center shadow-lg m-4'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            Procesando tu pago...
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col items-center gap-4'>
          <Loader2 className='h-8 w-8 animate-spin text-accent' />
          <p className='text-muted-foreground'>
            Estamos confirmando tu pago con Mercado Pago. Esto puede tardar unos
            segundos.
          </p>
          <p className='text-sm text-muted-foreground'>
            No cierres esta página. Tus tickets se mostrarán automáticamente
            cuando se confirme el pago.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
