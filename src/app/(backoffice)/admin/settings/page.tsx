import CategoryList from '@/components/admin/category/CategoryList';
import { CreateUserForm } from '@/components/admin/config/CreateUserForm';
import UpdateFeatures from '@/components/admin/config/UpdateFeatures';
import { UsersTable } from '@/components/admin/config/UsersTable';
import LocationList from '@/components/location/LocationList';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const data = await trpc.user.getAll();

  return (
    <div className='flex flex-col gap-4 py-4'>
      <UpdateFeatures />
      <section className='mb-4'>
        <div className='flex justify-between items-center px-4'>
          <h2 className='text-2xl font-bold'>Usuarios</h2>
          <CreateUserForm />
        </div>
        <UsersTable
          data={data.filter(
            (user) =>
              user.role !== 'ORGANIZER' && user.role !== 'CHIEF_ORGANIZER',
          )}
        />
      </section>
      <LocationList />
      <CategoryList />
    </div>
  );
}
