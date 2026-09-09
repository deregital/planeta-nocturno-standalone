import { desc, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import DeleteControlAdminButton from '@/app/control/(protected)/users/delete-button';
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
import { controlAdmins, controlRoles } from '@/db/control/schema';
import { formatRoleName } from '@/lib/control/role-name';
import {
  getControlAdminSession,
  requirePermissionOrRedirect,
} from '@/server/control/can-manage-tenants';

export default async function ControlUsersPage() {
  const { permissions } = await requirePermissionOrRedirect(
    'admins:read',
    '/' as Route,
  );
  const session = await getControlAdminSession();
  const canCreate = permissions.includes('admins:create');
  const canUpdate = permissions.includes('admins:update');
  const canDelete = permissions.includes('admins:delete');

  const admins = await getControlDb()
    .select({
      id: controlAdmins.id,
      username: controlAdmins.username,
      email: controlAdmins.email,
      roleName: controlRoles.name,
      createdAt: controlAdmins.createdAt,
    })
    .from(controlAdmins)
    .innerJoin(controlRoles, eq(controlAdmins.roleId, controlRoles.id))
    .orderBy(desc(controlAdmins.createdAt));

  return (
    <div className='space-y-6'>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <p className='text-sm font-medium text-accent'>Panel central</p>
          <h1 className='text-3xl font-bold text-gray-900'>Usuarios</h1>
          <p className='mt-1 text-sm text-gray-600'>
            Quién puede entrar a este panel ({admins.length})
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href={'/users/new' as Route}>
              <Plus />
              Nuevo usuario
            </Link>
          </Button>
        )}
      </div>

      <div className='overflow-hidden rounded-xl border border-stroke bg-white shadow-sm'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className='font-medium'>{admin.username}</TableCell>
                <TableCell>{admin.email}</TableCell>
                <TableCell>{formatRoleName(admin.roleName)}</TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat('es-AR').format(admin.createdAt)}
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    {canUpdate && (
                      <Button asChild variant='ghost' size='sm'>
                        <Link href={`/users/${admin.id}` as Route}>Editar</Link>
                      </Button>
                    )}
                    {canDelete && session?.user.id !== admin.id && (
                      <DeleteControlAdminButton
                        adminId={admin.id}
                        username={admin.username}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {admins.length === 0 && (
          <p className='p-8 text-center text-sm text-gray-500'>
            Todavía no hay usuarios.
          </p>
        )}
      </div>
    </div>
  );
}
