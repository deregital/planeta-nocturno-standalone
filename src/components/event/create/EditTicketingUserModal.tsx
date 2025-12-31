'use client';

import { Pencil } from 'lucide-react';
import { startTransition, useActionState, useEffect, useState } from 'react';
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
import { trpc } from '@/server/trpc/client';

type EditTicketingUserModalProps = {
  userId: string;
  onSuccess?: (updatedName: string) => void;
};

export function EditTicketingUserModal({
  userId,
  onSuccess,
}: EditTicketingUserModalProps) {
  const [open, setOpen] = useState(false);
  const { data: user, isLoading } = trpc.user.getById.useQuery(userId, {
    enabled: open && !!userId,
  });

  const initialState = user
    ? {
        fullName: user.fullName,
        name: user.name,
        email: user.email,
        role: user.role,
        birthDate: user.birthDate,
        dni: user.dni,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        instagram: user.instagram ?? null,
      }
    : undefined;

  const [state, formAction, isPending] = useActionState(updateUser, {
    data: initialState,
  });

  // Handle success - this runs when state.success becomes true
  useEffect(() => {
    if (state.success && user) {
      const updatedName = state.data?.name ?? user.name;
      toast.success('Usuario actualizado correctamente');

      onSuccess?.(updatedName);

      setTimeout(() => {
        setOpen(false);
      }, 150);
    }
  }, [state.success, state.data, user]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='ghost' size='icon' className='h-8 w-8'>
          <Pencil className='size-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className='py-4'>Cargando...</div>
        ) : user && initialState ? (
          <UserForm
            type='EDIT'
            userId={user.id}
            errors={state.errors}
            initialState={(state.data ?? initialState) as UserData}
            formAction={formAction}
            isPending={isPending}
            lockedRole='TICKETING'
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const formData = new FormData(e.currentTarget);
              startTransition(() => {
                formAction(formData);
              });
            }}
          />
        ) : (
          <div className='py-4'>Error al cargar el usuario</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
