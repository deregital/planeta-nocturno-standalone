'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';

import { createUser } from '@/app/(backoffice)/admin/users/create/actions';
import { UserForm } from '@/components/admin/config/UserForm';
import { ConfirmAdminCreationModal } from '@/components/admin/users/ConfirmAdminCreationModal';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function CreateUserFormInner({
  resetKey,
  onCredentialsModalClose,
}: {
  resetKey: number;
  onCredentialsModalClose: (open: boolean) => void;
}) {
  const [state, formAction, isPending] = useActionState(createUser, {});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [confirmAdminModalOpen, setConfirmAdminModalOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const pendingFormDataRef = useRef<FormData | null>(null);

  useEffect(() => {
    if (state.credentials) {
      setCreateDialogOpen(false);
      setTimeout(() => {
        setCredentialsModalOpen(true);
      }, 100);
      setConfirmAdminModalOpen(false);
      // Resetear completamente el estado después de crear exitosamente
      pendingFormDataRef.current = null;
      // Incrementar la key para forzar el reset del formulario
      setFormKey((prev) => prev + 1);
    }
  }, [state.credentials]);

  // Detectar cuando el formulario requiere confirmación de contraseña (ADMIN)
  useEffect(() => {
    if (
      state.requiresPasswordConfirmation &&
      pendingFormDataRef.current &&
      !state.credentials
    ) {
      // Verificar que el FormData pendiente no tenga el flag de confirmación
      const passwordConfirmed =
        pendingFormDataRef.current.get('passwordConfirmed');
      if (passwordConfirmed !== 'true') {
        setConfirmAdminModalOpen(true);
      }
    }
  }, [state.requiresPasswordConfirmation, state.credentials]);

  const handleCreateDialogOpen = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open && state.credentials) {
      setCredentialsModalOpen(false);
    }
    if (!open) {
      setConfirmAdminModalOpen(false);
      pendingFormDataRef.current = null;
    }
    // Cuando se abre el diálogo, asegurarse de limpiar cualquier estado pendiente
    if (open) {
      pendingFormDataRef.current = null;
      setConfirmAdminModalOpen(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Guardar los datos del formulario antes de enviarlo
    const formData = new FormData(e.currentTarget);
    // Crear una copia nueva del FormData para evitar referencias compartidas
    const newFormData = new FormData();
    for (const [key, value] of formData.entries()) {
      newFormData.append(key, value);
    }
    // Asegurarse de que no tenga el flag de confirmación previo
    newFormData.delete('passwordConfirmed');
    pendingFormDataRef.current = newFormData;
  };

  const handleConfirmAdmin = () => {
    // Cuando se confirma la contraseña, proceder con el submit del formulario
    if (pendingFormDataRef.current) {
      setConfirmAdminModalOpen(false);
      // Agregar flag para indicar que la contraseña fue confirmada
      pendingFormDataRef.current.set('passwordConfirmed', 'true');
      startTransition(() => {
        formAction(pendingFormDataRef.current!);
      });
    }
  };

  return (
    <>
      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className='w-fit'>+ Nuevo usuario</Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} title='Crear usuario'>
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
          </DialogHeader>
          <UserForm
            key={formKey}
            type='CREATE'
            initialState={state.data ?? undefined}
            formAction={formAction}
            isPending={isPending}
            errors={state.errors ?? undefined}
            onSubmit={handleFormSubmit}
          />
        </DialogContent>
      </Dialog>
      <ConfirmAdminCreationModal
        open={confirmAdminModalOpen}
        onOpenChange={(open) => {
          setConfirmAdminModalOpen(open);
          // Si se cierra el modal sin confirmar, volver al formulario de creación
          if (!open) {
            pendingFormDataRef.current = null;
            // Asegurar que el diálogo de creación esté abierto
            setCreateDialogOpen(true);
          }
        }}
        onConfirm={handleConfirmAdmin}
      />
      {state.credentials && (
        <CredentialsModal
          open={credentialsModalOpen}
          onOpenChange={(open) => {
            setCredentialsModalOpen(open);
            // Notificar al componente padre cuando se cierra el modal
            onCredentialsModalClose(open);
          }}
          credentials={state.credentials}
          type='user'
        />
      )}
    </>
  );
}

export function CreateUserForm() {
  const [actionKey, setActionKey] = useState(0);

  return (
    <CreateUserFormInner
      key={actionKey}
      resetKey={actionKey}
      onCredentialsModalClose={(open) => {
        // Cuando se cierra el modal de credenciales, resetear el estado del action
        if (!open) {
          setActionKey((prev) => prev + 1);
        }
      }}
    />
  );
}
