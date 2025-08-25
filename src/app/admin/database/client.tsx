'use client';
import {
  DatabaseTable,
  emittedBuyerColumns,
} from '@/components/admin/DatabaseTable';
import { genderTranslation } from '@/lib/translations';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  buyers,
}: {
  buyers: RouterOutputs['emittedTickets']['getAllUniqueBuyer'];
}) {
  const parsedBuyers = buyers.map((buyer) => ({
    ...buyer,
    age: `${buyer.age} años`,
    instagram: buyer.instagram || '-',
    gender:
      ((buyer.gender === 'female' ||
        buyer.gender === 'male' ||
        buyer.gender === 'other') &&
        genderTranslation[buyer.gender]) ||
      'No definido',
  }));

  return (
    <div className='flex flex-col gap-4'>
      <h1 className='text-4xl font-bold p-4'>Base de Datos</h1>
      <DatabaseTable columns={emittedBuyerColumns} data={parsedBuyers} />
    </div>
  );
}
