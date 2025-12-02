'use client';

import { useActionState, useEffect, useState } from 'react';

import { createUser } from '@/app/(backoffice)/admin/users/create/actions';
import { UserForm } from '@/components/admin/config/UserForm';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, {});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);

  useEffect(() => {
    if (state.credentials) {
      setCreateDialogOpen(false);
      setTimeout(() => {
        setCredentialsModalOpen(true);
      }, 100);
    }
  }, [state.credentials]);

  const handleCreateDialogOpen = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open && state.credentials) {
      setCredentialsModalOpen(false);
    }
  };

  const handleCredentialsModalClose = (open: boolean) => {
    setCredentialsModalOpen(open);
  };

  return (
    <>
      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className='w-fit'>+ Nuevo usuario</Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} title='Crear usuario'>
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
          </DialogHeader>
          <UserForm
            type='CREATE'
            initialState={state.data ?? undefined}
            formAction={formAction}
            isPending={isPending}
            errors={state.errors ?? undefined}
          />
        </DialogContent>
      </Dialog>
      {state.credentials && (
        <CredentialsModal
          open={credentialsModalOpen}
          onOpenChange={handleCredentialsModalClose}
          credentials={state.credentials}
          type='user'
        />
      )}
    </>
  );
}
