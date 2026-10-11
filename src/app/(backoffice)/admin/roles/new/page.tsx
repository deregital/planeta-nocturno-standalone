import { type Route } from 'next';

import RoleForm from '@/app/(backoffice)/admin/roles/form';
import GoBack from '@/components/common/GoBack';
import { requirePagePermission } from '@/server/rbac/guards';

export default async function NewRolePage() {
  await requirePagePermission('roles:create');

  return (
    <div className='flex flex-col gap-4 p-4'>
      <GoBack route={'/admin/roles' as Route} />
      <div>
        <h1 className='text-4xl font-bold text-accent'>Nuevo rol</h1>
        <p className='mt-1 text-sm text-accent-dark'>
          Definí qué puede ver y hacer un usuario con este rol.
        </p>
      </div>
      <RoleForm mode='create' />
    </div>
  );
}
