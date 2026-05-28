import { CreateOrganizerForm } from '@/components/admin/users/CreateOrganizerForm';
import { ImportUsersWrapper } from '@/components/admin/users/ImportUsersWrapper';
import { TagModal } from '@/components/admin/users/TagModal';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import { trpc } from '@/server/trpc/server';

export default async function UsersPage() {
  const data = await trpc.user.getOrganizers();

  return (
    <div className='flex min-w-0 flex-col gap-4 py-4'>
      <div className='flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='text-2xl font-bold text-accent sm:text-3xl'>
          Organizadores
        </h1>
        <div className='flex flex-wrap gap-2 sm:justify-end'>
          <TagModal type='CREATE' />
          <ImportUsersWrapper />
          <CreateOrganizerForm />
        </div>
      </div>
      <UsersTableWithFilters data={data} />
    </div>
  );
}
