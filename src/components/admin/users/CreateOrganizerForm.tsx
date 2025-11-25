'use client';

import { useActionState } from 'react';

import { createOrganizer } from '@/app/(backoffice)/admin/users/create/actions';
import { OrganizerForm } from '@/components/admin/users/OrganizerForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function CreateOrganizerForm() {
  const [state, formAction, isPending] = useActionState(createOrganizer, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className='w-fit'>+ Nuevo organizador</Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} title='Crear organizador'>
        <DialogHeader>
          <DialogTitle>Crear organizador</DialogTitle>
        </DialogHeader>
        <OrganizerForm
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
