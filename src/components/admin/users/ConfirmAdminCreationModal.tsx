'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';

import { validatePassword } from '@/app/actions/DataTable';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ConfirmAdminCreationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmAdminCreationModal({
  open,
  onOpenChange,
  onConfirm,
}: ConfirmAdminCreationModalProps) {
  const [state, formAction, isPending] = useActionState(validatePassword, {
    ok: false,
  });
  const [password, setPassword] = useState('');

  // Resetear el estado cuando se abre el modal
  useEffect(() => {
    if (open) {
      setPassword('');
    }
  }, [open]);

  // Cuando la contraseña es válida, ejecutar onConfirm y cerrar el modal
  useEffect(() => {
    if (state.ok && open) {
      // Pequeño delay para asegurar que el estado se actualice correctamente
      const timer = setTimeout(() => {
        onConfirm();
        onOpenChange(false);
        setPassword('');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [state.ok, open, onConfirm, onOpenChange]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPassword('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            Estás por crear un usuario{' '}
            <span className='font-bold'>Administrador</span>, ¿Estás seguro de
            crearlo?
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='space-y-4'>
            <p className='text-sm text-gray-600'>
              Para confirmar la creación de un usuario administrador, ingresá tu
              contraseña:
            </p>
            <InputWithLabel
              required
              label='Contraseña'
              id='password'
              name='password'
              type='password'
              value={password}
              error={state.error}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              autoFocus
            />
            <DialogFooter>
              <Button
                type='button'
                variant='ghost'
                onClick={() => {
                  handleClose(false);
                }}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending ? 'Validando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
