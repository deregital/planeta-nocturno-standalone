import { CreateOrganizerForm } from '@/components/admin/users/CreateOrganizerForm';
import { ImportUsersWrapper } from '@/components/admin/users/ImportUsersWrapper';
import { TagModal } from '@/components/admin/users/TagModal';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import { trpc } from '@/server/trpc/server';

export default async function UsersPage() {
  const data = await trpc.user.getOrganizers();

  return (
    <div className='flex flex-col gap-4 py-4'>
      <div className='flex justify-between items-center px-4'>
        <h1 className='text-2xl font-bold'>Organizadores</h1>
        <div className='flex gap-2'>
          <TagModal type='CREATE' />
          <ImportUsersWrapper />
          <CreateOrganizerForm />
        </div>
      </div>
      <UsersTableWithFilters data={data} />
    </div>
  );
}
