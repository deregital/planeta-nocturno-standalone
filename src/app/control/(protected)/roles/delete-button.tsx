'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  type DeleteControlRoleState,
  deleteControlRole,
} from '@/app/control/(protected)/roles/actions';
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog';

export default function DeleteControlRoleButton({
  roleId,
  roleName,
}: {
  roleId: string;
  roleName: string;
}) {
  const [state, action, pending] = useActionState<
    DeleteControlRoleState,
    FormData
  >(deleteControlRole, {});

  return (
    <div className='space-y-1'>
      <ConfirmActionDialog
        action={action}
        pending={pending}
        title='Eliminar rol'
        description={`Se eliminará el rol ${roleName}. Solo es posible si no tiene usuarios asignados.`}
        confirmLabel='Eliminar rol'
        triggerLabel='Eliminar'
        triggerVariant='destructiveGhost'
        confirmVariant='destructive'
        fields={{ roleId }}
      >
        <Trash2 />
      </ConfirmActionDialog>
      {state.error && <p className='text-xs text-red-600'>{state.error}</p>}
    </div>
  );
}
