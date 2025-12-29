import { CreateOrganizerForm } from '@/components/admin/users/CreateOrganizerForm';
import { ImportUsersWrapper } from '@/components/admin/users/ImportUsersWrapper';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  organizers,
}: {
  organizers: RouterOutputs['user']['getOrganizersByChiefOrganizer'];
}) {
  return (
    <div className='flex flex-col gap-4 py-4'>
      <div className='flex justify-between items-center px-4'>
        <h1 className='text-2xl font-bold'>Organizadores</h1>
        <div className='flex gap-2'>
          <ImportUsersWrapper />
          <CreateOrganizerForm />
        </div>
      </div>
      <UsersTableWithFilters data={organizers} />
    </div>
  );
}
