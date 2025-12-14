import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { updateOrganizer } from '@/app/(backoffice)/admin/users/[id]/edit/actions';
import {
  type OrganizerData,
  OrganizerForm,
} from '@/components/admin/users/OrganizerForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export default function EditOrganizerForm({
  organizer,
}: {
  organizer: NonNullable<RouterOutputs['user']['getById']>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateOrganizer, {
    data: {
      fullName: organizer.fullName,
      name: organizer.name,
      email: organizer.email,
      role: organizer.role,
      birthDate: organizer.birthDate,
      dni: organizer.dni,
      gender: organizer.gender,
      phoneNumber: organizer.phoneNumber,
      instagram: organizer.instagram,
    },
  });

  const utils = trpc.useUtils();
  useEffect(() => {
    if (state.success) {
      setOpen(false);
      utils.user.getByRole.invalidate();
      toast.success('Organizador actualizado correctamente');
    }
  }, [state.success, utils, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon'>
          <Pencil className='size-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar organizador</DialogTitle>
        </DialogHeader>
        <OrganizerForm
          type='EDIT'
          userId={organizer.id}
          initialState={state.data as OrganizerData}
          formAction={formAction}
          isPending={isPending}
          errors={state.errors}
        />
      </DialogContent>
    </Dialog>
  );
}
