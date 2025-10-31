'use client';
import { type StrictColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import Link from 'next/link';
import { format as formatPhoneNumber } from 'libphonenumber-js';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { type EmittedTicket } from '@/server/types';
import { Input } from '@/components/ui/input';

const columns: StrictColumnDef<EmittedTicket>[] = [
  {
    id: 'id',
    accessorFn: (row) => row.id,
    header: 'ID',
    meta: {
      exportValue: ({ index }) => (index + 1).toString(),
      exportHeader: 'ID',
    },
    cell: ({ row, table }) =>
      (table
        .getSortedRowModel()
        ?.flatRows?.findIndex((flatRow) => flatRow.id === row.id) || 0) + 1,
  },
  {
    id: 'fullName',
    accessorFn: (row) => row.fullName,
    header: 'Nombre',
    meta: {
      exportValue: (row) => row.original.fullName,
      exportHeader: 'Nombre',
    },
  },
  {
    id: 'phoneNumber',
    accessorFn: (row) => row.phoneNumber,
    header: 'Teléfono',
    cell: ({ row }) => {
      return (
        <Link
          href={`https://wa.me/${row.original.phoneNumber}`}
          target='_blank'
          className='text-blue-500 hover:text-blue-500/75 underline'
        >
          {formatPhoneNumber(row.original.phoneNumber, 'INTERNATIONAL')}
        </Link>
      );
    },
    meta: {
      exportValue: (row) => row.original.phoneNumber,
      exportHeader: 'Teléfono',
    },
  },
  {
    id: 'resendEmail',
    cell: ({ row }) => {
      const sendTicketMutation = trpc.emittedTickets.send.useMutation({
        onSuccess: () => {
          toast.success('Email reenviado con éxito');
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
      return (
        <Button
          disabled={sendTicketMutation.isPending}
          variant='accent'
          size='sm'
          onClick={() =>
            sendTicketMutation.mutate({ ticketId: row.original.id })
          }
        >
          Reenviar email
        </Button>
      );
    },
    header: 'Reenviar email',
    meta: {
      exportValue: () => '',
      exportHeader: '',
    },
  },
  {
    id: 'used',
    accessorFn: (row) => row.scanned,
    header: 'Ingresó',
    meta: {
      exportValue: (row) => (row.original.scanned ? 'Sí' : 'No'),
      exportHeader: 'Ingresó',
    },
    cell: ({ row }) => {
      return (
        <Input
          type='checkbox'
          checked={row.original.scanned}
          readOnly
          className='size-6'
        />
      );
    },
  },
];

export function TraditionalTicketTable({
  tickets,
}: {
  tickets: EmittedTicket[];
}) {
  return <DataTable columns={columns} data={tickets} />;
}
