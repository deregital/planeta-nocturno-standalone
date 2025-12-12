'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

import { createOrganizer } from '@/app/(backoffice)/admin/users/create/actions';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
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
  const session = useSession();
  const [state, formAction, isPending] = useActionState(createOrganizer, {});
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
            chiefOrganizerId={session.data?.user.id ?? undefined}
          />
        </DialogContent>
      </Dialog>
      {state.credentials && (
        <CredentialsModal
          open={credentialsModalOpen}
          onOpenChange={handleCredentialsModalClose}
          credentials={state.credentials}
          type='organizer'
        />
      )}
    </>
  );
}
