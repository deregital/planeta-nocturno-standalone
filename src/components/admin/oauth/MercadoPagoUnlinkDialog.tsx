'use client';

import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

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
import { trpc } from '@/server/trpc/client';

export default function MercadoPagoUnlinkDialog() {
  const requestUnlink = trpc.mercadoPago.requestUnlink.useMutation({
    onError(error) {
      toast.error(error.message);
    },
  });

  return (
    <Dialog onOpenChange={(open) => !open && requestUnlink.reset()}>
      <DialogTrigger asChild>
        <Button variant='outline'>Desvincular</Button>
      </DialogTrigger>
      <DialogContent className='flex max-w-lg flex-col gap-4'>
        <DialogHeader>
          <DialogTitle>Desvincular Mercado Pago</DialogTitle>
          <DialogDescription>
            Por seguridad, la desvinculación se confirma desde un link que te
            enviamos al mail de tu cuenta.
          </DialogDescription>
        </DialogHeader>
        {requestUnlink.data ? (
          <p className='text-sm font-medium text-green-600'>
            Te enviamos un mail a {requestUnlink.data.email}. Abrí el link para
            confirmar la desvinculación: vence en{' '}
            {requestUnlink.data.expiresInMinutes} minutos.
          </p>
        ) : (
          <Alert variant='destructive'>
            <AlertTriangle />
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              Una vez desvinculada la cuenta, no se van a poder cobrar entradas
              online hasta que se vuelva a conectar una cuenta de Mercado Pago.
            </AlertDescription>
          </Alert>
        )}
        {!requestUnlink.data && (
          <DialogFooter className='sm:justify-end'>
            <Button
              variant='destructive'
              disabled={requestUnlink.isPending}
              onClick={() => requestUnlink.mutate()}
            >
              {requestUnlink.isPending
                ? 'Enviando...'
                : 'Enviar mail de confirmación'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
