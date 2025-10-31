'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { ShareIcon } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { type RouterOutputs } from '@/server/routers/app';
import { Button } from '@/components/ui/button';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

function columns({
  eventSlug,
}: {
  eventSlug: string;
}): StrictColumnDef<RouterOutputs['organizer']['getMyCodesNotUsed'][number]>[] {
  return [
    {
      id: 'id',
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row, table }) =>
        (table
          .getSortedRowModel()
          ?.flatRows?.findIndex((flatRow) => flatRow.id === row.id) || 0) + 1,
      meta: {
        exportValue: ({ index }) => (index + 1).toString(),
        exportHeader: 'ID',
      },
    },
    {
      id: 'code',
      accessorKey: 'code',
      header: 'Código',
      accessorFn: (row) => row.code,
      meta: {
        exportValue: (row) => row.original.code,
        exportHeader: 'Código',
      },
    },
    {
      id: 'share',
      accessorFn: (row) => row.code,
      meta: {
        exportValue: () => '',
        exportHeader: '',
      },
      header: 'Compartir',
      cell: ({ row }) => {
        const basePath = window.location.origin;
        const url = `${basePath}/event/${eventSlug}?${INVITE_CODE_QUERY_PARAM}=${row.original.code}`;

        function copyToClipboard() {
          navigator.clipboard.writeText(url);
          toast.success('URL copiada al portapapeles');
        }
        return (
          <Button variant='ghost' size='icon' onClick={copyToClipboard}>
            <ShareIcon className='w-4 h-4' />
          </Button>
        );
      },
    },
  ];
}

export function InvitationTicketTable({
  codes,
  eventSlug,
}: {
  codes: RouterOutputs['organizer']['getMyCodesNotUsed'];
  eventSlug: string;
}) {
  return <DataTable columns={columns({ eventSlug })} data={codes} />;
}
