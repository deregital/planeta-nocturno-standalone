'use client';

import { Check, Lock, Pencil, Plus } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import DeleteRoleButton from '@/app/(backoffice)/admin/roles/delete-button';
import { Can } from '@/components/rbac/Can';
import { usePermissions } from '@/components/rbac/PermissionsProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getPermissionDefinition,
  getPermissionDepth,
  groupPermissionsByModule,
  type TenantPermission,
} from '@/lib/rbac/permissions';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

type Role = RouterOutputs['accessRole']['list'][number];

const permissionGroups = groupPermissionsByModule();

const CAPABILITY_BADGES: { permission: TenantPermission; label: string }[] = [
  { permission: 'organizer:team', label: 'Jefe de organizadores' },
  { permission: 'organizer:act', label: 'Actúa como organizador' },
  { permission: 'events:staff', label: 'Personal de eventos' },
];

function getCapabilityLabels(permissions: readonly TenantPermission[]) {
  const labels = CAPABILITY_BADGES.filter(({ permission }) =>
    permissions.includes(permission),
  ).map(({ label }) => label);
  // Todo jefe también actúa como organizador: alcanza con mostrar el jefe.
  return labels.includes('Jefe de organizadores')
    ? labels.filter((label) => label !== 'Actúa como organizador')
    : labels;
}

export default function Client({ roles }: { roles: Role[] }) {
  const { can } = usePermissions();
  const canUpdate = can('roles:update');
  const canDelete = can('roles:delete');

  return (
    <div className='flex flex-col gap-6 p-4'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-4xl font-bold text-accent'>Roles y permisos</h1>
          <p className='mt-1 text-sm text-accent-dark'>
            Qué puede ver y hacer cada usuario. Activar un permiso activa
            también los permisos de los que depende.
          </p>
        </div>
        <Can permission='roles:create'>
          <Button asChild className='w-full sm:w-auto'>
            <Link href={'/admin/roles/new' as Route}>
              <Plus />
              Nuevo rol
            </Link>
          </Button>
        </Can>
      </div>

      <div className='overflow-hidden rounded-xl border border-stroke bg-white'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Capacidades</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead>Usuarios</TableHead>
                {(canUpdate || canDelete) && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className='font-medium'>
                    <div className='flex items-center gap-2'>
                      {role.name}
                      {role.isSystem && (
                        <Badge variant='secondary'>Sistema</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1'>
                      {getCapabilityLabels(role.permissions).map((label) => (
                        <Badge key={label} variant='outline'>
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className='max-w-xs truncate text-sm text-muted-foreground'>
                    {role.description || '—'}
                  </TableCell>
                  <TableCell>{role.permissions.length}</TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell>
                      {role.isLocked ? (
                        <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                          <Lock className='size-3' />
                          No editable
                        </span>
                      ) : (
                        <div className='flex items-center gap-2'>
                          {canUpdate && (
                            <Button asChild variant='ghost' size='sm'>
                              <Link href={`/admin/roles/${role.id}` as Route}>
                                <Pencil />
                                Editar
                              </Link>
                            </Button>
                          )}
                          {canDelete && !role.isSystem && (
                            <DeleteRoleButton
                              roleId={role.id}
                              roleName={role.name}
                              userCount={role.userCount}
                            />
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <h2 className='text-2xl font-bold text-accent'>Matriz de permisos</h2>
        <div className='overflow-hidden rounded-xl border border-stroke bg-white'>
          <div className='max-h-[70vh] overflow-auto'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-white'>
                <TableRow>
                  <TableHead className='min-w-72'>Permiso</TableHead>
                  {roles.map((role) => (
                    <TableHead
                      key={role.id}
                      className='min-w-28 text-center whitespace-normal'
                    >
                      {role.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionGroups.map((group) => [
                  <TableRow
                    key={group.module}
                    className='bg-accent-ultra-light'
                  >
                    <TableCell
                      colSpan={roles.length + 1}
                      className='font-semibold text-accent-dark'
                    >
                      {group.label}
                    </TableCell>
                  </TableRow>,
                  ...group.permissions.map((permission) => {
                    const definition = getPermissionDefinition(permission);
                    return (
                      <TableRow key={permission}>
                        <TableCell
                          style={{
                            paddingLeft: `${getPermissionDepth(permission) * 1.25 + 0.5}rem`,
                          }}
                          title={definition.description}
                        >
                          {definition.label}
                        </TableCell>
                        {roles.map((role) => {
                          const granted = role.permissions.includes(permission);
                          return (
                            <TableCell
                              key={role.id}
                              className={cn(
                                'text-center',
                                granted && 'bg-accent-ultra-light',
                              )}
                            >
                              {granted ? (
                                <Check
                                  className={cn(
                                    'mx-auto size-4',
                                    role.isLocked
                                      ? 'text-muted-foreground'
                                      : 'text-accent',
                                  )}
                                />
                              ) : null}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  }),
                ])}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
