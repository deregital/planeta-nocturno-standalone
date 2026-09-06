import { asc, count, eq, sql } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import DeleteControlRoleButton from '@/app/control/(protected)/roles/delete-button';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getControlDb } from '@/db/control/client';
import {
  controlAdmins,
  controlRolePermissions,
  controlRoles,
} from '@/db/control/schema';
import { SUPER_ADMIN_ROLE_NAME } from '@/lib/control/permissions';
import { formatRoleName } from '@/lib/control/role-name';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';

export default async function ControlRolesPage() {
  const { permissions } = await requirePermissionOrRedirect(
    'roles:read',
    '/' as Route,
  );
  const canCreate = permissions.includes('roles:create');
  const canUpdate = permissions.includes('roles:update');
  const canDelete = permissions.includes('roles:delete');

  const roles = await getControlDb()
    .select({
      id: controlRoles.id,
      name: controlRoles.name,
      description: controlRoles.description,
      isSystem: controlRoles.isSystem,
      adminCount: count(controlAdmins.id),
    })
    .from(controlRoles)
    .leftJoin(controlAdmins, eq(controlAdmins.roleId, controlRoles.id))
    .groupBy(controlRoles.id)
    .orderBy(
      sql`case when ${controlRoles.name} = ${SUPER_ADMIN_ROLE_NAME} then 0 else 1 end`,
      asc(controlRoles.name),
    );

  const permissionRows = await getControlDb()
    .select({
      roleId: controlRolePermissions.roleId,
      permission: controlRolePermissions.permission,
    })
    .from(controlRolePermissions);

  const permissionCountByRole = new Map<string, number>();
  for (const row of permissionRows) {
    permissionCountByRole.set(
      row.roleId,
      (permissionCountByRole.get(row.roleId) ?? 0) + 1,
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <p className='text-sm font-medium text-accent'>Panel central</p>
          <h1 className='text-3xl font-bold text-gray-900'>Roles</h1>
          <p className='mt-1 text-sm text-gray-600'>
            Qué puede hacer cada tipo de usuario ({roles.length})
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href={'/roles/new' as Route}>
              <Plus />
              Nuevo rol
            </Link>
          </Button>
        )}
      </div>

      <div className='overflow-hidden rounded-xl border border-stroke bg-white shadow-sm'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const isSuperAdmin = role.name === SUPER_ADMIN_ROLE_NAME;
              return (
                <TableRow key={role.id}>
                  <TableCell className='font-medium'>
                    {formatRoleName(role.name)}
                    {isSuperAdmin && (
                      <span className='ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600'>
                        completo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='max-w-xs truncate text-sm text-gray-600'>
                    {role.description || '—'}
                  </TableCell>
                  <TableCell>
                    {isSuperAdmin
                      ? 'Todos'
                      : (permissionCountByRole.get(role.id) ?? 0)}
                  </TableCell>
                  <TableCell>{role.adminCount}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      {canUpdate && !isSuperAdmin && (
                        <Button asChild variant='ghost' size='sm'>
                          <Link href={`/roles/${role.id}` as Route}>
                            Editar
                          </Link>
                        </Button>
                      )}
                      {canDelete && !isSuperAdmin && !role.isSystem && (
                        <DeleteControlRoleButton
                          roleId={role.id}
                          roleName={formatRoleName(role.name)}
                        />
                      )}
                      {isSuperAdmin && (
                        <span className='text-xs text-gray-500'>
                          No editable
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
