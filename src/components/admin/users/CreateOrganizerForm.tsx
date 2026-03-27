'use client';

import { Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import React, { useActionState, useEffect, useState } from 'react';

import { createOrganizer } from '@/app/(backoffice)/admin/users/create/actions';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
import {
  defaultOrganizerState,
  OrganizerForm,
  type OrganizerData,
} from '@/components/admin/users/OrganizerForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function CreateOrganizerForm({
  children,
  initialData,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  children?: React.ReactNode;
  initialData?: Partial<OrganizerData>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = openProp !== undefined;
  const session = useSession();
  const [state, formAction, isPending] = useActionState(createOrganizer, {});
  const [internalOpen, setInternalOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);

  const dialogOpen = isControlled ? openProp : internalOpen;

  const setDialogOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChangeProp?.(open);
    } else {
      setInternalOpen(open);
    }
  };

  useEffect(() => {
    if (state.credentials) {
      setDialogOpen(false);
      setTimeout(() => {
        setCredentialsModalOpen(true);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.credentials]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && state.credentials) {
      setCredentialsModalOpen(false);
    }
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        {!isControlled && (
          <DialogTrigger asChild>
            {children ?? (
              <Button className='w-fit'>
                <Plus /> Nuevo organizador
              </Button>
            )}
          </DialogTrigger>
        )}
        <DialogContent
          aria-describedby={undefined}
          title='Crear organizador'
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Crear organizador</DialogTitle>
          </DialogHeader>
          <OrganizerForm
            type='CREATE'
            initialState={
              state.data ??
              (initialData
                ? { ...defaultOrganizerState, ...initialData }
                : undefined)
            }
            formAction={formAction}
            isPending={isPending}
            errors={state.errors ?? undefined}
            chiefOrganizerId={
              session.data?.user.role === 'CHIEF_ORGANIZER'
                ? session.data?.user.id
                : undefined
            }
            isAdmin={session.data?.user.role === 'ADMIN'}
          />
        </DialogContent>
      </Dialog>
      {state.credentials && (
        <CredentialsModal
          open={credentialsModalOpen}
          onOpenChange={setCredentialsModalOpen}
          credentials={state.credentials}
          type='organizer'
        />
      )}
    </>
  );
}
