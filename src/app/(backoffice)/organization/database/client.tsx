'use client';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import {
  DatabaseTable,
  emittedBuyerColumns,
} from '@/components/admin/DatabaseTable';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  buyers,
}: {
  buyers: RouterOutputs['emittedTickets']['getAllUniqueBuyerByOrganizer'];
}) {
  const router = useRouter();
  const session = useSession();

  const isOrganizer = session.data?.user.role === 'ORGANIZER';

  const columns = isOrganizer
    ? emittedBuyerColumns.filter((column) => column.id !== 'actions')
    : emittedBuyerColumns;

  return (
    <div className='flex flex-col gap-4'>
      <h1 className='text-4xl font-bold p-4 text-accent'>Base de Datos</h1>
      <DatabaseTable
        columns={columns}
        data={buyers}
        onClickRow={(id) => router.push(`/organization/database/${id}`)}
      />
    </div>
  );
}
