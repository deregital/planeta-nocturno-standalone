import { eq } from 'drizzle-orm';
import { type Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import ControlRoleForm from '@/app/control/(protected)/roles/form';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlRolePermissions, controlRoles } from '@/db/control/schema';
import {
  parseControlPermissions,
  SUPER_ADMIN_ROLE_NAME,
} from '@/lib/control/permissions';
import { formatRoleName } from '@/lib/control/role-name';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';

export default async function EditControlRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionOrRedirect('roles:update', '/roles' as Route);
  const roleId = (await params).id;

  const [role] = await getControlDb()
    .select({
      id: controlRoles.id,
      name: controlRoles.name,
      description: controlRoles.description,
      isSystem: controlRoles.isSystem,
    })
    .from(controlRoles)
    .where(eq(controlRoles.id, roleId))
    .limit(1);

  if (!role) notFound();
  if (role.name === SUPER_ADMIN_ROLE_NAME || role.isSystem) {
    redirect('/roles' as Route);
  }

  const permissionRows = await getControlDb()
    .select({ permission: controlRolePermissions.permission })
    .from(controlRolePermissions)
    .where(eq(controlRolePermissions.roleId, roleId));

  return (
    <div className='space-y-6'>
      <Button asChild variant='ghost'>
        <Link href={'/roles' as Route}>← Volver</Link>
      </Button>

      <div>
        <p className='text-sm font-medium text-accent'>Panel central</p>
        <h1 className='text-3xl font-bold text-gray-900'>
          Editar {formatRoleName(role.name)}
        </h1>
      </div>

      <ControlRoleForm
        mode='edit'
        initialValues={{
          roleId: role.id,
          name: formatRoleName(role.name),
          description: role.description ?? '',
          permissions: parseControlPermissions(
            permissionRows.map((row) => row.permission),
          ),
        }}
      />
    </div>
  );
}
