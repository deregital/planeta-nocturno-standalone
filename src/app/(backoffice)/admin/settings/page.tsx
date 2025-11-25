import UpdateFeatures from '@/components/admin/config/UpdateFeatures';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const data = await trpc.user.getAll();

  return (
    <div className='flex flex-col gap-4 py-4'>
      <UpdateFeatures />
      <section>
        <h2 className='mx-4 text-2xl font-bold'>Administradores</h2>
        <UsersTableWithFilters
          data={data.filter((user) => user.role === 'ADMIN')}
        />
      </section>
    </div>
  );
}
