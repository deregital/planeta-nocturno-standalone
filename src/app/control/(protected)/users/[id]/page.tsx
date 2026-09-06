import { asc, eq, sql } from 'drizzle-orm';
import { type Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import ControlAdminForm from '@/app/control/(protected)/users/form';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlAdmins, controlRoles } from '@/db/control/schema';
import { SUPER_ADMIN_ROLE_NAME } from '@/lib/control/permissions';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';

export default async function EditControlAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionOrRedirect('admins:update', '/users' as Route);
  const adminId = (await params).id;

  const [admin] = await getControlDb()
    .select({
      id: controlAdmins.id,
      username: controlAdmins.username,
      email: controlAdmins.email,
      roleId: controlAdmins.roleId,
    })
    .from(controlAdmins)
    .where(eq(controlAdmins.id, adminId))
    .limit(1);

  if (!admin) notFound();

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
        <h1 className='text-3xl font-bold text-gray-900'>
          Editar {admin.username}
        </h1>
      </div>

      <ControlAdminForm
        mode='edit'
        roles={roles}
        initialValues={{
          adminId: admin.id,
          username: admin.username,
          email: admin.email,
          password: '',
          roleId: admin.roleId,
        }}
      />
    </div>
  );
}
