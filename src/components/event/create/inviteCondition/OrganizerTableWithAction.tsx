import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from 'lucide-react';

import { DataTable } from '@/components/common/DataTable';
import { Input } from '@/components/ui/input';
import { type InviteCondition } from '@/server/types';
import { type CreateEventStore } from '@/app/admin/event/create/state';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { Button } from '@/components/ui/button';

type OrganizerTableData = {
  id: string;
  fullName: string;
  dni: string;
  phoneNumber: string;
  number: number;
};

function columns(
  numberTitle: string,
  type: InviteCondition,
  updateOrganizerNumber: CreateEventStore['updateOrganizerNumber'],
  deleteOrganizer: CreateEventStore['deleteOrganizer'],
): ColumnDef<OrganizerTableData>[] {
  return [
    {
      header: 'ID',
      accessorKey: 'id',
      cell: ({ row }) => {
        return <div>{row.original.id}</div>;
      },
    },
    {
      header: 'Nombre',
      accessorKey: 'fullName',
      cell: ({ row }) => {
        return <div>{row.original.fullName}</div>;
      },
    },
    {
      header: 'DNI',
      accessorKey: 'dni',
      cell: ({ row }) => {
        return <div>{row.original.dni}</div>;
      },
    },
    {
      header: 'Teléfono',
      accessorKey: 'phoneNumber',
      cell: ({ row }) => {
        return <div>{row.original.phoneNumber}</div>;
      },
    },
    {
      header: numberTitle,
      accessorKey: 'number',
      cell: ({ row }) => {
        return (
          <div className='flex gap-2'>
            <Input
              className='w-fit max-w-fit'
              type='number'
              value={row.original.number}
              onChange={(e) => {
                updateOrganizerNumber(
                  row.original.dni,
                  Number(e.target.value),
                  type,
                );
              }}
            />
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                deleteOrganizer(row.original.dni);
              }}
            >
              <TrashIcon className='w-4 h-4' />
            </Button>
          </div>
        );
      },
    },
  ];
}

export function OrganizerTableWithAction({
  data,
  children,
  numberTitle,
  type,
}: {
  data: OrganizerTableData[];
  children: React.ReactNode;
  numberTitle: string;
  type: InviteCondition;
}) {
  const updateOrganizerNumber = useCreateEventStore(
    (state) => state.updateOrganizerNumber,
  );
  const deleteOrganizer = useCreateEventStore((state) => state.deleteOrganizer);
  return (
    <div>
      <div className='flex w-full justify-end'>{children}</div>
      <DataTable
        disableExport
        fullWidth
        noResultsPlaceholder='No seleccionaste ningún organizador'
        divClassName='mx-0! w-full! max-w-full!'
        columns={columns(
          numberTitle,
          type,
          updateOrganizerNumber,
          deleteOrganizer,
        )}
        data={data}
      />
    </div>
  );
}
