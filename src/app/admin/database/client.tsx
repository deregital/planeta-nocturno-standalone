'use client';
import {
  DatabaseTable,
  emittedBuyerColumns,
} from '@/components/admin/DatabaseTable';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  buyers,
}: {
  buyers: RouterOutputs['emittedTickets']['getAllUniqueBuyer'];
}) {
  return (
    <div className='flex flex-col gap-4'>
      <h1 className='text-4xl font-bold p-4 text-accent'>Base de Datos</h1>
      <DatabaseTable columns={emittedBuyerColumns} data={buyers} />
    </div>
  );
}
