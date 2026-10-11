'use client';
import {
  DatabaseTable,
  emittedBuyerColumns,
} from '@/components/admin/DatabaseTable';
import { useCan } from '@/components/rbac/PermissionsProvider';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  buyers,
}: {
  buyers: RouterOutputs['emittedTickets']['getAllUniqueBuyer'];
}) {
  const canCreateOrganizers = useCan('organizers:create');
  const columns = canCreateOrganizers
    ? emittedBuyerColumns
    : emittedBuyerColumns.filter((column) => column.id !== 'actions');

  return (
    <div className='flex flex-col gap-4 py-4'>
      <h1 className='text-3xl font-bold px-4 text-accent'>Base de Datos</h1>
      <DatabaseTable columns={columns} data={buyers} />
    </div>
  );
}
