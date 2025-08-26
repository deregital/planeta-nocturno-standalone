'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format as formatPhoneNumber } from 'libphonenumber-js';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/common/DataTable';
import { type EmittedBuyerTable } from '@/server/schemas/emitted-tickets';
import { genderTranslation } from '@/lib/translations';

// Create a wrapper type that includes an id field for the DataTable
type EmittedBuyerTableWithId = EmittedBuyerTable & { id: string };

export const emittedBuyerColumns: ColumnDef<EmittedBuyerTableWithId>[] = [
  {
    accessorKey: 'dni',
    header: () => <p className='text-sm p-2 text-pn-slate'>DNI</p>,
    cell: ({ row }) => {
      return <p className='text-sm p-2'>{row.original.dni}</p>;
    },
  },
  {
    accessorKey: 'fullName',
    header: () => <p className='text-sm p-2 text-pn-slate'>Nombre</p>,
    cell: ({ row }) => {
      const fullName = row.original.fullName;
      return <p className='text-sm p-2'>{fullName}</p>;
    },
  },
  {
    accessorKey: 'mail',
    header: () => <p className='text-sm p-2 text-pn-slate'>Mail</p>,
    cell: ({ row }) => {
      const mail = row.original.mail;
      return <p className='text-sm p-2'>{mail}</p>;
    },
  },
  {
    accessorKey: 'age',
    header: () => <p className='text-sm p-2 text-pn-slate'>Edad</p>,
    cell: ({ row }) => {
      const age = row.original.age;
      return <p className='text-sm p-2'>{age}</p>;
    },
  },
  {
    accessorKey: 'gender',
    header: () => <p className='text-sm p-2 text-pn-slate'>Genero</p>,
    cell: ({ row }) => {
      const gender = row.original.gender;
      return (
        <p className='text-sm p-2'>
          {gender
            ? genderTranslation[gender as keyof typeof genderTranslation]
            : '-'}
        </p>
      );
    },
  },
  {
    accessorKey: 'phoneNumber',
    header: () => <p className='text-sm p-2 text-pn-slate'>Teléfono</p>,
    cell: ({ row }) => {
      const phoneNumber = row.original.phoneNumber;
      if (!phoneNumber) return '-';
      return (
        <p className='text-sm p-2'>
          {formatPhoneNumber(phoneNumber, 'INTERNATIONAL')}
        </p>
      );
    },
  },
  {
    accessorKey: 'instagram',
    header: () => <p className='text-sm p-2 text-pn-slate'>Instagram</p>,
    cell: ({ row }) => {
      const instagram = row.original.instagram;
      if (!instagram) return '-';
      return <p className='text-sm p-2'>{instagram}</p>;
    },
  },
];

interface TicketsTableProps {
  columns: ColumnDef<EmittedBuyerTableWithId, unknown>[];
  data: EmittedBuyerTable[];
}

export function DatabaseTable({ columns, data }: TicketsTableProps) {
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState('');

  // Add id field to data using dni as the unique identifier
  const dataWithId: EmittedBuyerTableWithId[] = data.map((item) => ({
    ...item,
    id: item.dni,
  }));

  // Filter data based on global filter
  const filteredData = dataWithId.filter((item) => {
    if (!globalFilter) return true;

    const searchValue = globalFilter
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const searchableFields = [
      item.dni,
      item.fullName,
      item.phoneNumber,
      item.mail,
      item.instagram,
    ].filter(Boolean);

    return searchableFields.some((field) => {
      const normalizedField = String(field)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normalizedField.includes(searchValue);
    });
  });

  const handleRowClick = (id: string) => {
    // Since we're using dni as id, we can directly use it for navigation
    router.push(`/admin/database/${id}`);
  };

  return (
    <div className='space-y-4'>
      {/* Filter and Actions */}
      <div className='flex items-center justify-between px-4'>
        <div className='flex sm:items-center justify-start gap-2 flex-col sm:flex-row'>
          <Input
            placeholder='Filtrar por nombre, DNI o teléfono...'
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className='min-w-full'
          />
          {/* Results count */}
          <p className='text-sm text-accent'>
            {filteredData.length} de {data.length} resultados
          </p>
          {globalFilter && (
            <Button
              variant={'ghost'}
              onClick={() => setGlobalFilter('')}
              className='px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors'
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        onClickRow={handleRowClick}
      />
    </div>
  );
}
