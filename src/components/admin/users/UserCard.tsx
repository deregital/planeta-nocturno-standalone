import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import Link from 'next/link';

import { type User } from '@/server/types';
import { Button } from '@/components/ui/button';

export function UserCard({ user }: { user: User }) {
  return (
    <div className='border border-stroke rounded-md p-4 w-max h-max group relative'>
      <h1>
        <span className='font-bold'>Nombre:</span> {user.name}
      </h1>
      <p>
        <span className='font-bold'>Email:</span> {user.email}
      </p>
      <p>
        <span className='font-bold'>Rol:</span> {user.role}
      </p>
      <p>
        <span className='font-bold'>Creado el:</span>{' '}
        {format(user.createdAt, 'dd/MM/yyyy')}
      </p>
      <div className='top-1 right-1 hidden group-hover:flex group-hover:absolute'>
        <Link href={`/admin/users/${user.id}/edit`}>
          <Button size='icon' className='rounded-full'>
            <Pencil />
          </Button>
        </Link>
      </div>
    </div>
  );
}
