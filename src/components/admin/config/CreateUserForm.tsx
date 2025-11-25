'use client';

import { useActionState } from 'react';

import { createUser } from '@/app/(backoffice)/admin/users/create/actions';
import { UserForm } from '@/components/admin/config/UserForm';
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

  return (
    <Dialog>
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
  );
}
