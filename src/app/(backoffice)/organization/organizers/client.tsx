'use client';
import { CreateOrganizerForm } from '@/components/admin/users/CreateOrganizerForm';
import { ImportUsersWrapper } from '@/components/admin/users/ImportUsersWrapper';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import OrganizerSkeleton from '@/components/organization/organizers/OrganizerSkeleton';
import { trpc } from '@/server/trpc/client';

export default function Client({
  chiefOrganizerId,
}: {
  chiefOrganizerId: string;
}) {
  const { data, isLoading } = trpc.user.getByRole.useQuery('ORGANIZER');

  return (
    <div className='flex flex-col gap-4 py-4'>
      <div className='flex justify-between items-center px-4'>
        <h1 className='text-2xl font-bold'>Organizadores</h1>
        <div className='flex gap-2'>
          <ImportUsersWrapper />
          <CreateOrganizerForm />
        </div>
      </div>
      {isLoading ? (
        <OrganizerSkeleton />
      ) : (
        <UsersTableWithFilters
          data={
            data?.filter(
              (user) => user.chiefOrganizerId === chiefOrganizerId,
            ) ?? []
          }
        />
      )}
    </div>
  );
}
