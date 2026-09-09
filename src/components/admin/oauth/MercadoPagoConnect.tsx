'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const MP_STATUS_COOKIE = 'mp_oauth_status';
const MP_TEST_EVENT_PROMPT_KEY = 'mp_test_event_prompt_shown';

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
  const [testEventModalOpen, setTestEventModalOpen] = useState(false);

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

  useEffect(() => {
    if (status !== 'success') return;
    if (sessionStorage.getItem(MP_TEST_EVENT_PROMPT_KEY)) return;

    setTestEventModalOpen(true);
    sessionStorage.setItem(MP_TEST_EVENT_PROMPT_KEY, '1');
  }, [status]);

  function dismissTestEventModal() {
    setTestEventModalOpen(false);
  }

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

      <Dialog open={testEventModalOpen} onOpenChange={setTestEventModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cuenta vinculada correctamente</DialogTitle>
            <DialogDescription>
              Te recomendamos crear un evento de prueba y realizar un cobro de
              prueba para confirmar que la cuenta de Mercado Pago asociada es la
              que querés usar para recibir pagos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={dismissTestEventModal}
            >
              Más tarde
            </Button>
            <Button asChild>
              <Link href='/admin/event/create' onClick={dismissTestEventModal}>
                Crear evento de prueba
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {connected ? (
        <Button variant='success' disabled>
          Ya estás conectado a Mercado Pago
        </Button>
      ) : authUrl ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Conectar con Mercado Pago</Button>
          </DialogTrigger>
          <DialogContent className='flex max-w-lg flex-col gap-4'>
            <DialogHeader>
              <DialogTitle>Conectar Mercado Pago</DialogTitle>
            </DialogHeader>
            <p className='text-center text-sm text-gray-500'>
              Al vincular tu cuenta, los cobros de tickets se acreditan en tu
              Mercado Pago. Nosotros no recibimos ni administramos ese dinero:
              la conexión solo permite procesar el pago en tu sitio y confirmar
              las entradas de forma automática cuando se acredita.
            </p>
            <Alert
              className={cn(
                'border-amber-200 bg-amber-50 text-amber-950',
                '[&>svg]:text-amber-600',
              )}
            >
              <AlertTriangle />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription className='text-amber-900/90'>
                La vinculación se realizará con la cuenta de Mercado Pago que
                esté abierta en este dispositivo. Si no es la cuenta que querés
                vincular, cerrá sesión en Mercado Pago antes de continuar.
              </AlertDescription>
            </Alert>
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
