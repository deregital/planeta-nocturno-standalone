import { asc, sql } from 'drizzle-orm';
import { type Route } from 'next';
import Link from 'next/link';

import ControlAdminForm from '@/app/control/(protected)/users/form';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlRoles } from '@/db/control/schema';
import { SUPER_ADMIN_ROLE_NAME } from '@/lib/control/permissions';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';

export default async function NewControlAdminPage() {
  await requirePermissionOrRedirect('admins:create', '/users' as Route);

  const roles = await getControlDb()
    .select({
      id: controlRoles.id,
      name: controlRoles.name,
      description: controlRoles.description,
    })
    .from(controlRoles)
    .orderBy(
      sql`case when ${controlRoles.name} = ${SUPER_ADMIN_ROLE_NAME} then 0 else 1 end`,
      asc(controlRoles.name),
    );

  return (
    <div className='space-y-6'>
      <Button asChild variant='ghost'>
        <Link href={'/users' as Route}>← Volver</Link>
      </Button>

      <div>
        <p className='text-sm font-medium text-accent'>Panel central</p>
        <h1 className='text-3xl font-bold text-gray-900'>Nuevo usuario</h1>
        <p className='mt-1 text-sm text-gray-600'>
          Solo podrá usar este panel. No tendrá acceso a las plataformas.
        </p>
      </div>

      <ControlAdminForm mode='create' roles={roles} />
    </div>
  );
}
