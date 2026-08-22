'use client';

import { useActionState } from 'react';
import {
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import {
  type TenantLifecycleState,
  type TenantLifecycleStatus,
  updateTenantLifecycle,
} from '@/app/control/(protected)/tenants/actions';
import { Button } from '@/components/ui/button';

export default function TenantActions({
  tenantId,
  tenantName,
  status,
  databaseName,
}: {
  tenantId: number;
  tenantName: string;
  status: TenantLifecycleStatus;
  databaseName: string | null;
}) {
  const [state, action, pending] = useActionState<
    TenantLifecycleState,
    FormData
  >(updateTenantLifecycle, {});

  if (status === 'deleting') {
    return (
      <div className='space-y-1'>
        <LifecycleButton
          action={action}
          tenantId={tenantId}
          operation='delete'
          pending={pending}
          label='Reintentar eliminación'
          destructive
          confirmMessage={deleteConfirmation(tenantName, databaseName)}
        >
          <RotateCcw />
        </LifecycleButton>
        <ActionError message={state.error} />
      </div>
    );
  }

  return (
    <div className='space-y-1'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon'>
          <Link
            href={`/tenants/${tenantId}` as Route}
            aria-label='Editar página'
            title='Editar página'
          >
            <Pencil />
          </Link>
        </Button>

        {status === 'active' && (
          <LifecycleButton
            action={action}
            tenantId={tenantId}
            operation='suspend'
            pending={pending}
            label='Suspender página'
          >
            <Pause />
          </LifecycleButton>
        )}
        {status === 'suspended' && (
          <LifecycleButton
            action={action}
            tenantId={tenantId}
            operation='activate'
            pending={pending}
            label='Activar página'
          >
            <Play />
          </LifecycleButton>
        )}
        {status === 'failed' && !databaseName && (
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
        {status !== 'provisioning' && (
          <LifecycleButton
            action={action}
            tenantId={tenantId}
            operation='delete'
            pending={pending}
            label='Eliminar página'
            destructive
            confirmMessage={deleteConfirmation(tenantName, databaseName)}
          >
            <Trash2 />
          </LifecycleButton>
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
  operation: 'suspend' | 'activate' | 'delete';
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

function deleteConfirmation(tenantName: string, databaseName: string | null) {
  const databaseMessage = databaseName
    ? ` La base ${databaseName} se conservará con el sufijo _deleted.`
    : '';
  return `¿Eliminar ${tenantName}? La página dejará de estar disponible.${databaseMessage}`;
}

function ActionError({ message }: { message?: string }) {
  return message ? <p className='text-xs text-red-600'>{message}</p> : null;
}
