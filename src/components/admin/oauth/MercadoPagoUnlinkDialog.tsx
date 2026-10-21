'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  TransferAliasField,
  validateTransferAlias,
} from '@/components/admin/oauth/TransferAliasField';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

function unlinkWarning({
  savedAlias,
  draftAlias,
  requiresAlias,
}: {
  savedAlias?: string | null;
  draftAlias: string;
  requiresAlias: boolean;
}) {
  const alias = (savedAlias || draftAlias)?.trim();
  if (alias) {
    return `Al desvincular, las entradas pagas se cobran por transferencia al alias ${alias}. El comprador manda el comprobante a tu mail de contacto y liberás las entradas desde la página del evento.`;
  }

  if (requiresAlias) {
    return 'Tenés eventos activos con entradas pagas. Indicá el alias al que se van a transferir: el comprador manda el comprobante a tu mail de contacto y liberás las entradas desde la página del evento.';
  }

  return 'Al desvincular, no se van a poder cobrar entradas online ni crear tickets pagos hasta que vuelvas a conectar una cuenta.';
}

export default function MercadoPagoUnlinkDialog() {
  const [open, setOpen] = useState(false);
  const [transferAlias, setTransferAlias] = useState('');
  const [transferAliasError, setTransferAliasError] = useState<string | null>(
    null,
  );

  const {
    data: requirements,
    isLoading: isLoadingRequirements,
    isFetching: isFetchingRequirements,
  } = trpc.mercadoPago.unlinkRequirements.useQuery(undefined, {
    enabled: open,
  });
  const requirementsLoading = isLoadingRequirements || isFetchingRequirements;
  const requiresTransferAlias = requirements?.requiresTransferAlias ?? false;

  const utils = trpc.useUtils();
  const requestUnlink = trpc.mercadoPago.requestUnlink.useMutation({
    onSuccess() {
      utils.mercadoPago.getTransferAlias.invalidate();
      utils.mercadoPago.unlinkRequirements.invalidate();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  function handleRequestUnlink() {
    const value = transferAlias.trim();
    if (!requiresTransferAlias && !value) {
      requestUnlink.mutate();
      return;
    }

    const error = validateTransferAlias(value, requiresTransferAlias);
    setTransferAliasError(error);
    if (error) return;
    requestUnlink.mutate({ transferAlias: value });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          requestUnlink.reset();
          setTransferAliasError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant='destructive' className='hover:bg-red-600'>
          Desvincular
        </Button>
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
          <>
            <Alert variant='destructive'>
              <AlertTriangle />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription className='w-full'>
                {requirements && !requirementsLoading ? (
                  unlinkWarning({
                    savedAlias: requirements.transferAlias,
                    draftAlias: transferAlias,
                    requiresAlias: requirements.requiresTransferAlias,
                  })
                ) : (
                  <span className='flex w-full flex-col gap-2'>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-4/5' />
                  </span>
                )}
              </AlertDescription>
            </Alert>
            {requirements &&
              !requirementsLoading &&
              !requirements.transferAlias && (
                <TransferAliasField
                  id='unlink-transfer-alias'
                  value={transferAlias}
                  onChange={(value) => {
                    setTransferAlias(value);
                    setTransferAliasError(null);
                  }}
                  error={transferAliasError}
                  required={requiresTransferAlias}
                  description={
                    requiresTransferAlias
                      ? 'Tenés eventos activos con entradas pagas: mientras no haya una cuenta vinculada, los compradores van a transferir a este alias y mandar el comprobante a tu mail de contacto.'
                      : 'Opcional. Si lo cargás, las entradas pagas se cobran por transferencia a este alias mientras Mercado Pago no esté vinculado.'
                  }
                />
              )}
          </>
        )}
        {!requestUnlink.data && (
          <DialogFooter className='sm:justify-end'>
            <Button
              variant='destructive'
              disabled={requestUnlink.isPending || requirementsLoading}
              onClick={handleRequestUnlink}
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
