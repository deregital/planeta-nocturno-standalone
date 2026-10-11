import { CreateOrganizerForm } from '@/components/admin/users/CreateOrganizerForm';
import { ImportUsersWrapper } from '@/components/admin/users/ImportUsersWrapper';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import { hasPermission, type TenantPermission } from '@/lib/rbac/permissions';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function UsersPage() {
  const access = await requirePagePermission('organizers:read');
  const can = (permission: TenantPermission) =>
    hasPermission(access.permissions, permission);

  const data = can('organizers:read_all')
    ? await trpc.user.getOrganizers()
    : await trpc.user.getOrganizersByChiefOrganizer();

  return (
    <div className='flex min-w-0 flex-col gap-4 py-4'>
      <div className='flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='text-2xl font-bold text-accent sm:text-3xl'>
          Organizadores
        </h1>
        <div className='flex flex-wrap gap-2 sm:justify-end'>
          {can('organizers:import') && <ImportUsersWrapper />}
          {can('organizers:create') && <CreateOrganizerForm />}
        </div>
      </div>
      <UsersTableWithFilters data={data} />
    </div>
  );
}
