import { type Route } from 'next';
import Link from 'next/link';

import ControlRoleForm from '@/app/control/(protected)/roles/form';
import { Button } from '@/components/ui/button';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';

export default async function NewControlRolePage() {
  await requirePermissionOrRedirect('roles:create', '/roles' as Route);

  return (
    <div className='space-y-6'>
      <Button asChild variant='ghost'>
        <Link href={'/roles' as Route}>← Volver</Link>
      </Button>

      <div>
        <p className='text-sm font-medium text-accent'>Panel central</p>
        <h1 className='text-3xl font-bold text-gray-900'>Nuevo rol</h1>
        <p className='mt-1 text-sm text-gray-600'>
          Definí qué acciones puede realizar un usuario del panel.
        </p>
      </div>

      <ControlRoleForm mode='create' />
    </div>
  );
}
