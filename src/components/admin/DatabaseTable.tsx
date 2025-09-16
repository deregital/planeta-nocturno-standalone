'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { format as formatPhoneNumber } from 'libphonenumber-js';
import { ArrowDown, ArrowUp, ArrowUpDown, Cake } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SelectGroup } from '@radix-ui/react-select';
import { format } from 'date-fns';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { genderTranslation } from '@/lib/translations';
import { daysUntilBirthday } from '@/lib/utils';
import { type EmittedBuyerTable } from '@/server/schemas/emitted-tickets';

// Create a wrapper type that includes an id field for the DataTable
type EmittedBuyerTableWithId = EmittedBuyerTable & { id: string };

export const emittedBuyerColumns: ColumnDef<EmittedBuyerTableWithId>[] = [
  {
    accessorKey: 'dni',
    header: () => <p className='text-sm p-2'>DNI/Pasaporte</p>,
    cell: ({ row }) => {
      return <p className='text-sm p-2'>{row.original.dni}</p>;
    },
  },
  {
    accessorKey: 'fullName',
    header: () => <p className='text-sm p-2'>Nombre</p>,
    cell: ({ row }) => {
      const fullName = row.original.fullName;
      return <p className='text-sm p-2'>{fullName}</p>;
    },
  },
  {
    accessorKey: 'mail',
    header: () => <p className='text-sm p-2'>Mail</p>,
    cell: ({ row }) => {
      const mail = row.original.mail;
      return <p className='text-sm p-2'>{mail}</p>;
    },
  },
  {
    accessorKey: 'age',
    header: () => <p className='text-sm p-2'>Edad</p>,
    cell: ({ row }) => {
      const age = row.original.age;
      return <p className='text-sm p-2'>{age}</p>;
    },
  },
  {
    accessorKey: 'birthDate',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Fecha de Nacimiento
          {sorted === 'asc' && (
            <>
              <Cake className='h-4 w-4' />
              <ArrowUp className='h-4 w-4' />
            </>
          )}
          {sorted === 'desc' && (
            <>
              <Cake className='h-4 w-4' />
              <ArrowDown className='h-4 w-4' />
            </>
          )}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = daysUntilBirthday(rowA.getValue(columnId) as string);
      const b = daysUntilBirthday(rowB.getValue(columnId) as string);
      return a - b; // el más cercano al cumple va primero
    },
    cell: ({ row }) => {
      const birthDate = row.original.birthDate;
      return <p className='text-sm p-2'>{format(birthDate, 'dd/MM/yyyy')}</p>;
    },
  },
  {
    accessorKey: 'gender',
    header: () => <p className='text-sm p-2'>Genero</p>,
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
    header: () => <p className='text-sm p-2'>Teléfono</p>,
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
    header: () => <p className='text-sm p-2'>Instagram</p>,
    cell: ({ row }) => {
      const instagram = row.original.instagram;
      if (!instagram) return '-';
      return <p className='text-sm p-2'>{instagram}</p>;
    },
  },
];

const months = [
  'No seleccionado',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface TicketsTableProps {
  columns: ColumnDef<EmittedBuyerTableWithId, unknown>[];
  data: EmittedBuyerTable[];
}

export function DatabaseTable({ columns, data }: TicketsTableProps) {
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('0');

  const dataWithId: EmittedBuyerTableWithId[] = data.map((item) => ({
    ...item,
    id: item.dni,
  }));

  // Filter by month of birth
  const dataWithIdFilteredByMonth = useMemo(() => {
    return selectedMonth !== '0'
      ? dataWithId.filter((p) => {
          const month = new Date(p.birthDate).getMonth() + 1;
          return month === Number(selectedMonth);
        })
      : dataWithId;
  }, [dataWithId, selectedMonth]);

  // Filter data based on global filter
  const filteredData = useMemo(() => {
    return dataWithIdFilteredByMonth.filter((item) => {
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
  }, [dataWithIdFilteredByMonth, globalFilter]);

  const handleRowClick = (id: string) => {
    router.push(`/admin/database/${id}`);
  };

  return (
    <div className='space-y-4'>
      {/* Filter and Actions */}
      <div className='flex items-center justify-between px-4'>
        <div className='flex md:items-center justify-start w-full gap-4 flex-col md:flex-row'>
          <div className='md:w-80 w-full'>
            <p className='text-sm text-accent'>
              Filtrar por nombre, DNI, teléfono, mail o Instagram
            </p>
            <Input
              placeholder='Nombre, DNI, mail...'
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className='max-full self-end'
            />
          </div>
          <div className='flex flex-col'>
            <p className='text-sm text-accent'>Filtrar por mes de nacimiento</p>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Filtrar por mes de nacimiento' />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Mes de nacimiento</SelectLabel>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {/* Results count */}
          <p className='text-sm text-accent pt-4'>
            {filteredData.length} de {data.length} resultados
          </p>
          {(globalFilter || selectedMonth !== '0') && (
            <Button
              variant={'ghost'}
              onClick={() => {
                setGlobalFilter('');
                setSelectedMonth('0');
              }}
              className='px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors self-end'
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
