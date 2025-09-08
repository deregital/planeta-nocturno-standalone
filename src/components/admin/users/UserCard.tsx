import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import Link from 'next/link';

import { type User } from '@/server/types';
import { Button } from '@/components/ui/button';
import { DeleteUserModal } from '@/components/admin/users/DeleteUserModal';
import { roleTranslation } from '@/lib/translations';

export function UserCard({
  user,
  editable,
}: {
  user: User;
  editable: boolean;
}) {
  return (
    <div className='border border-stroke rounded-md p-4 w-max h-max group relative'>
      <h1>
        <span className='font-bold'>Nombre:</span> {user.name}
      </h1>
      <p>
        <span className='font-bold'>Email:</span> {user.email}
      </p>
      <p>
        <span className='font-bold'>Rol:</span> {roleTranslation[user.role]}
      </p>
      <p>
        <span className='font-bold'>Creado el:</span>{' '}
        {format(user.createdAt, 'dd/MM/yyyy')}
      </p>
      {editable && (
        <div className='top-1 right-1 hidden group-hover:flex flex-col gap-2 group-hover:absolute'>
          <Link href={`/admin/users/${user.id}/edit`}>
            <Button size='icon' className='rounded-full'>
              <Pencil />
            </Button>
          </Link>
          <DeleteUserModal user={user} />
        </div>
      )}
    </div>
  );
}
