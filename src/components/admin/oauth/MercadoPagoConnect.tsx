'use client';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

type MercadoPagoConnectProps = {
  isConnected: boolean;
  authUrl: string | null;
};

export default function MercadoPagoConnect({
  isConnected,
  authUrl,
}: MercadoPagoConnectProps) {
  const searchParams = useSearchParams();
  const status = searchParams.get('mp');

  const connected = isConnected || status === 'success';

  return (
    <>
      {status === 'success' && (
        <p className='text-sm font-medium text-green-600'>
          Mercado Pago se conectó correctamente.
        </p>
      )}
      {status === 'error' && (
        <p className='text-sm font-medium text-red-500'>
          Ocurrió un error al conectar con Mercado Pago. Intentá nuevamente.
        </p>
      )}

      {connected ? (
        <Button variant='success' disabled>
          Ya estás conectado a Mercado Pago
        </Button>
      ) : authUrl ? (
        <a href={authUrl} target='_blank' rel='noopener noreferrer'>
          <Button>Conectar con Mercado Pago</Button>
        </a>
      ) : (
        <Button variant='outline' disabled>
          Configuración de Mercado Pago incompleta
        </Button>
      )}
    </>
  );
}
