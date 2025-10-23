'use client';

import { useActionState } from 'react';

import { UserForm } from '@/components/admin/users/UserForm';
import { createUser } from '@/app/admin/users/create/actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
