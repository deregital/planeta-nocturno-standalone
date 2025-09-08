import { Plus } from 'lucide-react';
import Link from 'next/link';

import { trpc } from '@/server/trpc/server';
import { UserCard } from '@/components/admin/users/UserCard';
import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';

export default async function UsersPage() {
  const data = await trpc.user.getAll();
  const session = await auth();

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex justify-between items-center'>
        <h1 className='text-2xl font-bold'>Usuarios</h1>
        <Link href='/admin/users/create'>
          <Button>
            <Plus />
            Nuevo usuario
          </Button>
        </Link>
      </div>
      <div className='flex flex-wrap gap-4'>
        {data.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            editable={session?.user.id !== user.id}
          />
        ))}
      </div>
    </div>
  );
}
