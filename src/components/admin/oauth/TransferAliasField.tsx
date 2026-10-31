'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { transferAliasSchema } from '@/server/schemas/payment-settings';
import { trpc } from '@/server/trpc/client';

export const TRANSFER_ALIAS_LABEL =
  'En caso de error, poné a qué alias deben transferirte la plata';

/** Devuelve el mensaje de error, o `null` si el valor es válido. */
export function validateTransferAlias(value: string, required: boolean) {
  if (!value.trim()) return required ? 'El alias es obligatorio' : null;
  const result = transferAliasSchema.safeParse(value);
  return result.success ? null : result.error.issues[0].message;
}

export function TransferAliasField({
  id,
  value,
  onChange,
  error,
  required = false,
  description,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
  description?: string;
}) {
  return (
    <div className='flex w-full flex-col gap-1.5 text-left'>
      <Label htmlFor={id}>
        {TRANSFER_ALIAS_LABEL}
        {required && <span className='text-red-500'> *</span>}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder='mi.alias.mp'
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {description && (
        <p className='text-xs text-muted-foreground'>{description}</p>
      )}
      {error && <p className='text-sm font-medium text-red-500'>{error}</p>}
    </div>
  );
}

/** Edición del alias cuando Mercado Pago ya está vinculado. */
export function TransferAliasForm() {
  const utils = trpc.useUtils();
  const { data: savedAlias, isLoading } =
    trpc.mercadoPago.getTransferAlias.useQuery();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(savedAlias ?? '');
  }, [savedAlias]);

  const update = trpc.mercadoPago.updateTransferAlias.useMutation({
    onSuccess: () => {
      toast.success('Alias actualizado');
      utils.mercadoPago.getTransferAlias.invalidate();
      utils.mercadoPago.unlinkRequirements.invalidate();
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  if (isLoading) return null;

  return (
    <form
      className='flex w-full max-w-md flex-col gap-2'
      onSubmit={(event) => {
        event.preventDefault();
        const validationError = validateTransferAlias(value, false);
        setError(validationError);
        if (validationError) return;
        update.mutate({ transferAlias: value.trim() || null });
      }}
    >
      <TransferAliasField
        id='transfer-alias'
        value={value}
        onChange={(next) => {
          setValue(next);
          setError(null);
        }}
        error={error}
        description='Si Mercado Pago falla al cobrar, los compradores van a ver este alias para transferir el total y mandar el comprobante a tu mail de contacto.'
      />
      <Button
        type='submit'
        variant='outline'
        className='w-fit'
        disabled={value.trim() === (savedAlias ?? '')}
        loading={update.isPending}
      >
        {update.isPending ? 'Guardando...' : 'Guardar alias'}
      </Button>
    </form>
  );
}
