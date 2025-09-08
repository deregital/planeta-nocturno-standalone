import { trpc } from '@/server/trpc/server';
import { UserCard } from '@/components/admin/users/UserCard';

export default async function UsersPage() {
  const data = await trpc.user.getAll();

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='text-2xl font-bold'>Usuarios</h1>
      {data.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
