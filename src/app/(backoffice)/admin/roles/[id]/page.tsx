import { TRPCError } from '@trpc/server';
import { type Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import z from 'zod';

import RoleForm from '@/app/(backoffice)/admin/roles/form';
import GoBack from '@/components/common/GoBack';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission('roles:update');
  const { id } = await params;

  const validatedId = z.uuid().safeParse(id);
  if (!validatedId.success) notFound();

  const role = await trpc.accessRole
    .getById(validatedId.data)
    .catch((error) => {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
      throw error;
    });

  if (!role) notFound();
  if (role.isLocked) redirect('/admin/roles' as Route);

  return (
    <div className='flex flex-col gap-4 p-4'>
      <GoBack route={'/admin/roles' as Route} />
      <div>
        <h1 className='text-4xl font-bold text-accent'>Editar {role.name}</h1>
        {role.isSystem && (
          <p className='mt-1 text-sm text-accent-dark'>
            Rol de sistema: podés ajustar sus permisos, pero no eliminarlo.
          </p>
        )}
      </div>
      <RoleForm
        mode='edit'
        initialValues={{
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: role.permissions,
        }}
      />
    </div>
  );
}
