'use client';

import type { ControlPermission } from '@/lib/control/permissions';

import { useActionState } from 'react';
import {
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import {
  type TenantLifecycleState,
  type TenantLifecycleStatus,
  updateTenantLifecycle,
} from '@/app/control/(protected)/tenants/actions';
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog';
import { Button } from '@/components/ui/button';

export default function TenantActions({
  tenantId,
  tenantName,
  status,
  databaseName,
  recycled = false,
  permissions,
}: {
  tenantId: number;
  tenantName: string;
  status: TenantLifecycleStatus;
  databaseName: string | null;
  recycled?: boolean;
  permissions: ControlPermission[];
}) {
  const [state, action, pending] = useActionState<
    TenantLifecycleState,
    FormData
  >(updateTenantLifecycle, {});

  const can = (permission: ControlPermission) =>
    permissions.includes(permission);

  if (recycled) {
    if (!can('tenants:restore')) return null;

    return (
      <div className='space-y-1'>
        <ConfirmActionDialog
          action={action}
          pending={pending}
          title='Restaurar plataforma'
          description={`${tenantName} saldrá de la papelera y volverá a estar activa y disponible.`}
          confirmLabel='Restaurar plataforma'
          triggerLabel='Restaurar plataforma'
          triggerVariant='ghost'
          confirmVariant='success'
          fields={{
            tenantId: String(tenantId),
            operation: 'restore',
          }}
        >
          <Undo2 />
        </ConfirmActionDialog>
        <ActionError message={state.error} />
      </div>
    );
  }

  if (status === 'deleting') {
    return <p className='text-xs text-gray-500'>Eliminación en curso…</p>;
  }

  return (
    <div className='space-y-1'>
      <div className='flex items-center gap-2'>
        {can('tenants:update') && (
          <Button asChild variant='ghost' size='icon'>
            <Link
              href={`/tenants/${tenantId}` as Route}
              aria-label='Editar plataforma'
              title='Editar plataforma'
            >
              <Pencil />
            </Link>
          </Button>
        )}

        {status === 'active' && can('tenants:suspend') && (
          <LifecycleButton
            action={action}
            tenantId={tenantId}
            operation='suspend'
            pending={pending}
            label='Suspender plataforma'
          >
            <Pause />
          </LifecycleButton>
        )}
        {status === 'suspended' && can('tenants:activate') && (
          <LifecycleButton
            action={action}
            tenantId={tenantId}
            operation='activate'
            pending={pending}
            label='Activar plataforma'
          >
            <Play />
          </LifecycleButton>
        )}
        {status === 'failed' && !databaseName && can('tenants:create') && (
          <Button asChild variant='ghost' size='icon'>
            <Link
              href={`/tenants/new?retry=${tenantId}` as Route}
              aria-label='Reintentar creación'
              title='Reintentar creación'
            >
              <RotateCcw />
            </Link>
          </Button>
        )}
        {status === 'failed' && databaseName && (
          <span className='text-xs text-red-600'>Requiere revisión</span>
        )}
        {(status === 'active' || status === 'suspended') &&
          can('tenants:recycle') && (
            <ConfirmActionDialog
              action={action}
              pending={pending}
              title='Enviar plataforma a la papelera'
              description={`${tenantName} será suspendida y dejará de estar disponible. Podrás restaurarla posteriormente desde la papelera.`}
              confirmLabel='Enviar a la papelera'
              triggerLabel='Enviar a la papelera'
              fields={{
                tenantId: String(tenantId),
                operation: 'recycle',
              }}
            >
              <Trash2 />
            </ConfirmActionDialog>
          )}
      </div>
      <ActionError message={state.error} />
    </div>
  );
}

function LifecycleButton({
  action,
  tenantId,
  operation,
  pending,
  label,
  destructive,
  confirmMessage,
  children,
}: {
  action: (formData: FormData) => void;
  tenantId: number;
  operation: 'suspend' | 'activate' | 'recycle' | 'restore';
  pending: boolean;
  label: string;
  destructive?: boolean;
  confirmMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type='hidden' name='tenantId' value={tenantId} />
      <input type='hidden' name='operation' value={operation} />
      <Button
        type='submit'
        variant={destructive ? 'destructiveGhost' : 'ghost'}
        size='icon'
        disabled={pending}
        aria-label={label}
        title={label}
      >
        {pending ? <LoaderCircle className='animate-spin' /> : children}
      </Button>
    </form>
  );
}

function ActionError({ message }: { message?: string }) {
  return message ? <p className='text-xs text-red-600'>{message}</p> : null;
}
