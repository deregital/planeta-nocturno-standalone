import { trpc } from '@/server/trpc/server';
import { UsersTableWithFilters } from '@/components/admin/users/UsersTableWithFilters';
import { CreateUserForm } from '@/components/admin/users/CreateUserForm';

export default async function UsersPage() {
  const data = await trpc.user.getAll();

  return (
    <div className='flex flex-col gap-4 py-4'>
      <div className='flex justify-between items-center px-4'>
        <h1 className='text-2xl font-bold'>Usuarios</h1>
        <CreateUserForm />
      </div>
      <UsersTableWithFilters data={data} />
    </div>
  );
}
