'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { format as formatPhoneNumber } from 'libphonenumber-js';
import { ArrowDownAZ } from 'lucide-react';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

const ticketChiefColumns: StrictColumnDef<
  RouterOutputs['emittedTickets']['getByEventId'][number]
>[] = [
  {
    id: 'buyerCode',
    accessorKey: 'buyerCode',
    header: ({ column }) => {
      return (
        <div
          className='mx-auto w-full'
          style={{
            width: `${column.getSize()}px`,
          }}
        >
          ID
        </div>
      );
    },
    minSize: 50,
    size: 50,
    maxSize: 50,
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <div className='flex items-center justify-center gap-2 text-sm'>
          <span>{row.original.buyerCode}</span>
        </div>
      );
    },
    meta: {
      exportValue: (row) => row.original.buyerCode,
      exportHeader: 'ID',
    },
  },
  {
    id: 'fullName',
    accessorKey: 'fullName',
    sortingFn: 'text',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          className='pl-0 mx-auto font-bold'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Nombre
          <ArrowDownAZ
            className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
          />
        </Button>
      );
    },
    minSize: 50,
    size: 50,
    maxSize: 50,
    enableResizing: false,
    cell: ({ row }) => {
      return <p className='w-full capitalize'>{row.original.fullName}</p>;
    },
    meta: {
      exportValue: (row) => row.original.fullName,
      exportHeader: 'Nombre',
    },
  },
  {
    id: 'dni',
    accessorKey: 'dni',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          className='pl-0 text-center w-full font-bold text-sm'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          DNI
          <ArrowDownAZ
            className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
          />
        </Button>
      );
    },
    minSize: 30,
    size: 30,
    maxSize: 30,
    enableResizing: false,
    cell: ({ row }) => {
      return <p className='w-full text-center'>{row.original.dni}</p>;
    },
    meta: {
      exportValue: (row) => row.original.dni,
      exportHeader: 'DNI',
    },
  },
  {
    id: 'phoneNumber',
    accessorKey: 'phoneNumber',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          className='pl-0 text-center w-full font-bold text-sm'
        >
          Teléfono
        </Button>
      );
    },
    minSize: 30,
    size: 30,
    maxSize: 30,
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <a
          href={`https://wa.me/${row.original.phoneNumber}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-sm p-2 underline text-blue-500 hover:text-blue-500/75'
        >
          {formatPhoneNumber(row.original.phoneNumber, 'INTERNATIONAL')}
        </a>
      );
    },
    meta: {
      exportValue: (row) => row.original.phoneNumber,
      exportHeader: 'Teléfono',
    },
  },
  {
    id: 'mail',
    accessorKey: 'mail',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          className='pl-0 text-center w-full font-bold text-sm'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Correo
          <ArrowDownAZ
            className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
          />
        </Button>
      );
    },
    minSize: 30,
    size: 30,
    maxSize: 30,
    enableResizing: false,
    cell: ({ row }) => {
      return <p className='w-full text-center'>{row.original.mail}</p>;
    },
    meta: {
      exportValue: (row) => row.original.mail,
      exportHeader: 'Correo',
    },
  },
  {
    id: 'invitedBy',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          className='text-sm text-center p-2 font-bold w-full'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Organizador
          <ArrowDownAZ
            className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
          />
        </Button>
      );
    },
    accessorFn: (row) => row.ticketGroup.invitedBy,
    minSize: 30,
    size: 30,
    maxSize: 30,
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <p className='w-full text-center'>
          {row.original.ticketGroup.invitedBy || '-'}
        </p>
      );
    },
    meta: {
      exportValue: (row) => row.original.ticketGroup.invitedBy || '-',
      exportHeader: 'Organizador',
    },
  },
  {
    id: 'scanned',
    accessorKey: 'scanned',
    meta: {
      exportValue: (row) => (row.original.scanned ? 'Sí' : 'No'),
      exportHeader: 'Usado',
    },
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          className='pl-0 text-center w-full font-bold text-sm'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Usado
          <ArrowDownAZ
            className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
          />
        </Button>
      );
    },
    minSize: 50,
    size: 50,
    maxSize: 50,
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <div className='flex items-center justify-center h-8'>
          <Input
            /* disabled */
            type='checkbox'
            className='size-6'
            readOnly
            checked={row.original.scanned}
          />
        </div>
      );
    },
  },
];

export function TicketTableSectionChief({
  tickets,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
}) {
  return (
    <DataTable
      columns={ticketChiefColumns}
      data={tickets}
      exportFileName={'Tickets'}
    />
  );
}
