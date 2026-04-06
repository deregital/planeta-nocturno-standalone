'use client';

import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

import GoBack from '@/components/common/GoBack';
import DotsLoader from '@/components/icons/DotsLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    }
  }, [paymentUrl]);

  if (paymentUrl)
    return (
      <div className='flex justify-center items-center h-full'>
        <Card className='w-full max-w-md mx-auto text-center shadow-lg m-4'>
          <CardHeader>
            <CardTitle className='text-2xl font-bold'>
              Redirigiendo a pasarela de pago
            </CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col items-center gap-4'>
            <Loader2 className='h-8 w-8 animate-spin text-accent' />
            <p className='text-sm text-muted-foreground'>
              No cierres esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className='flex justify-center items-center h-full'>
      <GoBack
        route='/'
        title='Volver al inicio'
        className='absolute top-24 md:left-26 left-4'
      />
      <Card className='w-full max-w-md mx-auto text-center shadow-lg m-4'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            Procesando tu pago...
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col items-center gap-4'>
          <DotsLoader className='h-6 w-6 text-accent' />
          <p className='text-muted-foreground'>
            Recarga la página para verificar el estado de tu pago. Los tickets
            serán enviados a tu email.
          </p>
          <p className='text-sm text-muted-foreground'>
            No cierres esta página.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
