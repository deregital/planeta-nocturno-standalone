'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import {
  createUser,
  type UserFirstTimeCredentials,
} from '@/app/(backoffice)/admin/users/create/actions';
import { UserForm } from '@/components/admin/config/UserForm';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TicketingUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function TicketingUserModal({
  open,
  onOpenChange,
  onSuccess,
}: TicketingUserModalProps) {
  const [state, formAction, isPending] = useActionState(createUser, {});
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [credentialsSnapshot, setCredentialsSnapshot] =
    useState<UserFirstTimeCredentials | null>(null);
  const lastCredentialsSignature = useRef<string | null>(null);

  useEffect(() => {
    if (state.credentials) {
      const signature = `${state.credentials.username}-${state.credentials.password}`;
      if (signature === lastCredentialsSignature.current) {
        return;
      }
      lastCredentialsSignature.current = signature;
      setCredentialsSnapshot(state.credentials);
      onSuccess?.();
      onOpenChange(false);
      setTimeout(() => {
        setCredentialsModalOpen(true);
      }, 100);
      setFormKey((prev) => prev + 1);
    }
  }, [state.credentials, onOpenChange, onSuccess]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          title='Crear usuario de acceso'
        >
          <DialogHeader>
            <DialogTitle>Crear usuario de acceso</DialogTitle>
          </DialogHeader>
          <UserForm
            key={formKey}
            type='CREATE'
            lockedRole='TICKETING'
            initialState={state.data ?? undefined}
            formAction={formAction}
            isPending={isPending}
            errors={state.errors ?? undefined}
          />
        </DialogContent>
      </Dialog>
      {credentialsSnapshot && (
        <CredentialsModal
          open={credentialsModalOpen}
          onOpenChange={setCredentialsModalOpen}
          credentials={credentialsSnapshot}
          type='user'
        />
      )}
    </>
  );
}
