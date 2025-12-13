'use client';

import { useActionState, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { updateUser } from '@/app/(backoffice)/admin/users/[id]/edit/actions';
import { type UserData, UserForm } from '@/components/admin/config/UserForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { type User } from '@/server/types';

export function EditUserForm({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateUser, {
    data: {
      fullName: user.fullName,
      name: user.name,
      email: user.email,
      role: user.role,
      birthDate: user.birthDate,
      dni: user.dni,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      instagram: user.instagram,
    },
  });

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      toast.success('Usuario actualizado correctamente');
    }
  }, [state.success, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon'>
          <Pencil className='size-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
        </DialogHeader>
        <UserForm
          type='EDIT'
          userId={user.id}
          errors={state.errors}
          initialState={state.data as UserData}
          formAction={formAction}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
