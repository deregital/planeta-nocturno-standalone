'use client';

import { KeyRound } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

import {
  resetPassword,
  type ResetPasswordActionState,
} from '@/app/(backoffice)/admin/users/create/actions';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { type Role } from '@/server/types';

type ResetPasswordFormProps = {
  userId: string;
  userName: string;
  userRole?: Role;
  trigger?: React.ReactNode;
};

export function ResetPasswordForm({
  userId,
  userName,
  userRole,
  trigger,
}: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    resetPassword,
    {} as ResetPasswordActionState,
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (state.credentials) {
      setResetDialogOpen(false);
      setCredentialsModalOpen(true);
      setPassword('');
    }
  }, [state.credentials]);

  const handleResetDialogOpen = (open: boolean) => {
    setResetDialogOpen(open);
    if (!open) {
      setPassword('');
    }
  };

  const handleCredentialsModalClose = (open: boolean) => {
    setCredentialsModalOpen(open);
  };

  return (
    <>
      <Dialog open={resetDialogOpen} onOpenChange={handleResetDialogOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant='ghost' size='icon' title='Restablecer contraseña'>
              <KeyRound className='size-4' />
            </Button>
          )}
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          title='Restablecer contraseña'
        >
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <form className='flex flex-col gap-4' action={formAction}>
            <input type='hidden' name='userId' value={userId} />
            <p className='text-sm text-gray-600'>
              Ingresá la nueva contraseña para el usuario{' '}
              <span className='font-semibold'>{userName}</span>
            </p>
            <InputWithLabel
              required
              label='Nueva contraseña'
              id='password'
              name='password'
              type='password'
              value={password}
              error={state.errors?.password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
            {state.errors?.general && (
              <p className='pl-1 font-bold text-xs text-red-500'>
                {state.errors.general}
              </p>
            )}
            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleResetDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending ? 'Restableciendo...' : 'Restablecer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {state.credentials && (
        <CredentialsModal
          open={credentialsModalOpen}
          onOpenChange={handleCredentialsModalClose}
          credentials={state.credentials}
          type={userRole === 'ORGANIZER' ? 'organizer' : 'user'}
        />
      )}
    </>
  );
}
