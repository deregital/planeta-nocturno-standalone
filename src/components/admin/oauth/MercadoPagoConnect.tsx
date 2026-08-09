'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const MP_STATUS_COOKIE = 'mp_oauth_status';

type MercadoPagoConnectProps = {
  isConnected: boolean;
  authUrl: string | null;
};

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setStatusCookie(value: string) {
  document.cookie = `${MP_STATUS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=300; SameSite=Lax`;
}

export default function MercadoPagoConnect({
  isConnected,
  authUrl,
}: MercadoPagoConnectProps) {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('mp');
  const [cookieStatus, setCookieStatus] = useState<string | null>(null);

  useEffect(() => {
    if (urlStatus === 'success') {
      setStatusCookie('success');
      setCookieStatus('success');
      return;
    }

    setCookieStatus(getCookie(MP_STATUS_COOKIE));
  }, [urlStatus]);

  const status =
    urlStatus === 'error'
      ? 'error'
      : urlStatus === 'success' || cookieStatus === 'success'
        ? 'success'
        : null;

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
        <Dialog>
          <DialogTrigger asChild>
            <Button>Conectar con Mercado Pago</Button>
          </DialogTrigger>
          <DialogContent className='flex flex-col items-center justify-center'>
            <DialogHeader>
              <DialogTitle>Conectar Mercado Pago</DialogTitle>
            </DialogHeader>
            <div className='text-center text-gray-500 p-2'>
              Al vincular tu cuenta, los cobros de tickets se acreditan en tu
              Mercado Pago. Nosotros no recibimos ni administramos ese dinero:
              la conexión solo permite procesar el pago en tu sitio y confirmar
              las entradas de forma automática cuando se acredita.
            </div>
            <DialogFooter className='sm:justify-end'>
              <a href={authUrl} target='_blank' rel='noopener noreferrer'>
                <Button className='px-8'>Conectar con Mercado Pago</Button>
              </a>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Button variant='outline' disabled>
          Configuración de Mercado Pago incompleta
        </Button>
      )}
    </>
  );
}
