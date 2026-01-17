import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
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
  const [formKey, setFormKey] = useState(0);
  const prevOpenRef = useRef(false);
  const successHandledRef = useRef(false);
  const [initialFormState, setInitialFormState] =
    useState<OrganizerData | null>(null);

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
    if (open && !initialFormState) {
      setInitialFormState({
        fullName: organizer.fullName,
        name: organizer.name,
        email: organizer.email,
        role: organizer.role,
        password: '',
        birthDate: organizer.birthDate,
        dni: organizer.dni,
        gender: organizer.gender,
        phoneNumber: organizer.phoneNumber,
        instagram: organizer.instagram ?? '',
        chiefOrganizerId: organizer.chiefOrganizerId ?? '',
      });
    }
  }, [open, organizer, initialFormState]);

  // Calcular el estado inicial - solo cambia cuando el diálogo se abre
  const currentInitialState: OrganizerData = useMemo(() => {
    if (open && initialFormState) {
      return initialFormState;
    }
    return {
      fullName: organizer.fullName,
      name: organizer.name,
      email: organizer.email,
      role: organizer.role,
      password: '',
      birthDate: organizer.birthDate,
      dni: organizer.dni,
      gender: organizer.gender,
      phoneNumber: organizer.phoneNumber,
      instagram: organizer.instagram ?? '',
      chiefOrganizerId: organizer.chiefOrganizerId ?? '',
    };
  }, [open, initialFormState, organizer]);

  useEffect(() => {
    if (state.success && !successHandledRef.current) {
      successHandledRef.current = true;
      setOpen(false);
      utils.user.getByRole.invalidate();
      toast.success('Organizador actualizado correctamente');
    }
  }, [state.success, utils]);

  // Resetear el estado cuando el diálogo se cierra
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      if (state.success) {
        setFormKey((prev) => prev + 1);
        successHandledRef.current = false;
        setInitialFormState(null);
      }
    }
    prevOpenRef.current = open;
  }, [open, state.success]);

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
          key={formKey}
          type='EDIT'
          userId={organizer.id}
          initialState={currentInitialState}
          formAction={formAction}
          isPending={isPending}
          errors={state.errors}
        />
      </DialogContent>
    </Dialog>
  );
}
