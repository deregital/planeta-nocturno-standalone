'use client';

import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

import GoBack from '@/components/common/GoBack';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RELOAD_INTERVAL_MS = 4000;

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export default function TicketsPendingClient({
  paymentUrl,
}: {
  paymentUrl?: string;
}) {
  useEffect(() => {
    if (paymentUrl) {
      deleteCookie('pendingPaymentUrl');
      window.location.href = paymentUrl;
      return;
    }

    const timer = setInterval(
      () => window.location.reload(),
      RELOAD_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [paymentUrl]);

  if (paymentUrl) return null;

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
            No cierres esta página.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
