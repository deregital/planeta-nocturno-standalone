'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { clearMercadoPagoStatusCookie } from '@/components/admin/oauth/MercadoPagoConnect';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';

type UnlinkMercadoPagoClientProps = {
  token: string | null;
  isConnected: boolean;
};

export default function UnlinkMercadoPagoClient({
  token,
  isConnected,
}: UnlinkMercadoPagoClientProps) {
  const [result, setResult] = useState<{ pending: boolean } | null>(null);
  const confirmUnlink = trpc.mercadoPago.confirmUnlink.useMutation({
    onSuccess(data) {
      clearMercadoPagoStatusCookie();
      setResult(data);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const settingsLink = (
    <Button asChild variant='outline' className='w-fit'>
      <Link href='/admin/settings'>Volver a Configuración</Link>
    </Button>
  );

  if (result) {
    return (
      <div className='flex max-w-2xl flex-col gap-4'>
        <p className='font-medium text-green-600'>
          {result.pending
            ? 'La desvinculación de Mercado Pago está en proceso y puede tardar unos minutos en completarse.'
            : 'Mercado Pago se desvinculó correctamente.'}
        </p>
        {settingsLink}
      </div>
    );
  }

  if (!token) {
    return (
      <div className='flex max-w-2xl flex-col gap-4'>
        <p className='text-accent-dark'>
          {isConnected
            ? 'El link no es válido, ya se usó o venció. Podés pedir uno nuevo desde Configuración.'
            : 'Mercado Pago no está vinculado a la plataforma.'}
        </p>
        {settingsLink}
      </div>
    );
  }

  return (
    <div className='flex max-w-2xl flex-col gap-4'>
      <Alert variant='destructive'>
        <AlertTriangle />
        <AlertTitle>Esta acción no se puede deshacer</AlertTitle>
        <AlertDescription>
          Al desvincular la cuenta de Mercado Pago no se van a poder cobrar
          entradas online hasta que se vuelva a conectar una cuenta.
        </AlertDescription>
      </Alert>
      <div className='flex gap-2'>
        <Button
          variant='destructive'
          disabled={confirmUnlink.isPending}
          onClick={() => confirmUnlink.mutate({ token })}
        >
          {confirmUnlink.isPending
            ? 'Desvinculando...'
            : 'Confirmar desvinculación'}
        </Button>
        <Button asChild variant='ghost'>
          <Link href='/admin/settings'>Cancelar</Link>
        </Button>
      </div>
    </div>
  );
}
