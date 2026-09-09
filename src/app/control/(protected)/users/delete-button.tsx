'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  type DeleteControlAdminState,
  deleteControlAdmin,
} from '@/app/control/(protected)/users/actions';
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog';

export default function DeleteControlAdminButton({
  adminId,
  username,
}: {
  adminId: string;
  username: string;
}) {
  const [state, action, pending] = useActionState<
    DeleteControlAdminState,
    FormData
  >(deleteControlAdmin, {});

  return (
    <div className='space-y-1'>
      <ConfirmActionDialog
        action={action}
        pending={pending}
        title='Eliminar usuario'
        description={`Se eliminará el acceso de ${username} a este panel. No afecta a las cuentas de las plataformas.`}
        confirmLabel='Eliminar usuario'
        triggerLabel='Eliminar'
        triggerVariant='destructiveGhost'
        confirmVariant='destructive'
        fields={{ adminId }}
      >
        <Trash2 />
      </ConfirmActionDialog>
      {state.error && <p className='text-xs text-red-600'>{state.error}</p>}
    </div>
  );
}
