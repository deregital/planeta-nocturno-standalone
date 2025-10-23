'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, ArrowDown, ArrowUp, Cake, Edit } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { format as formatPhoneNumber } from 'libphonenumber-js';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import { type RouterOutputs } from '@/server/routers/app';
import { Button } from '@/components/ui/button';
import { daysUntilBirthday } from '@/lib/utils';
import { genderTranslation, roleTranslation } from '@/lib/translations';
import { type role as roleEnum } from '@/drizzle/schema';
import { DeleteUserModal } from '@/components/admin/users/DeleteUserModal';

export const userColumns: StrictColumnDef<
  RouterOutputs['user']['getAll'][number]
>[] = [
  {
    id: 'autoId',
    accessorKey: 'autoId',
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
        <div className='text-sm'>
          <span>{row.original.autoId}</span>
        </div>
      );
    },
    meta: {
      exportValue: (row) => row.original.id,
      exportHeader: 'ID',
    },
  },
  {
    accessorKey: 'role',
    header: () => <p className='text-sm p-2'>Rol</p>,
    cell: ({ row }) => {
      return (
        <p className='text-sm p-2'>
          {
            roleTranslation[
              row.original.role as (typeof roleEnum.enumValues)[number]
            ]
          }
        </p>
      );
    },
    meta: {
      exportValue: (row) =>
        roleTranslation[
          row.original.role as (typeof roleEnum.enumValues)[number]
        ],
      exportHeader: 'Rol',
    },
  },
  {
    id: 'dni',
    accessorKey: 'dni',
    header: () => <p className='text-sm p-2'>DNI/Pasaporte</p>,
    cell: ({ row }) => {
      return <p className='text-sm p-2'>{row.original.dni}</p>;
    },
    meta: {
      exportValue: (row) => row.original.dni,
      exportHeader: 'DNI/Pasaporte',
    },
  },
  {
    accessorKey: 'fullName',
    header: () => <p className='text-sm p-2'>Nombre</p>,
    cell: ({ row }) => {
      const fullName = row.original.fullName;
      return <p className='text-sm p-2'>{fullName}</p>;
    },
    meta: {
      exportValue: (row) => row.original.fullName,
      exportHeader: 'Nombre',
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
    meta: {
      exportValue: (row) =>
        formatInTimeZone(row.original.birthDate, 'UTC', 'dd/MM/yyyy'),
      exportHeader: 'Fecha de Nacimiento',
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = daysUntilBirthday(rowA.getValue(columnId) as string);
      const b = daysUntilBirthday(rowB.getValue(columnId) as string);
      return a - b; // el más cercano al cumple va primero
    },
    cell: ({ row }) => {
      const birthDate = row.original.birthDate;
      return (
        <p className='text-sm p-2'>
          {formatInTimeZone(birthDate, 'UTC', 'dd/MM/yyyy')}
        </p>
      );
    },
  },
  {
    accessorKey: 'age',
    header: () => <p className='text-sm p-2'>Edad</p>,
    cell: ({ row }) => {
      return (
        <p className='text-sm p-2'>
          {differenceInYears(new Date(), new Date(row.original.birthDate))}
        </p>
      );
    },
    meta: {
      exportValue: (row) =>
        String(differenceInYears(new Date(), new Date(row.original.birthDate))),
      exportHeader: 'Edad',
    },
  },
  {
    id: 'gender',
    accessorKey: 'gender',
    header: () => <p className='text-sm p-2'>Género</p>,
    meta: {
      exportValue: (row) => {
        const gender = row.original.gender;
        return gender
          ? genderTranslation[gender as keyof typeof genderTranslation]
          : '-';
      },
      exportHeader: 'Género',
    },
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
        <a
          href={`https://wa.me/${phoneNumber}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-sm p-2 underline text-blue-500 hover:text-blue-500/75'
        >
          {formatPhoneNumber(phoneNumber, 'INTERNATIONAL')}
        </a>
      );
    },
    meta: {
      exportValue: (row) =>
        formatPhoneNumber(row.original.phoneNumber, 'INTERNATIONAL') || '-',
      exportHeader: 'Teléfono',
    },
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: () => <p className='text-sm p-2'>Mail</p>,
    cell: ({ row }) => {
      const mail = row.original.email;
      return <p className='text-sm p-2'>{mail}</p>;
    },
    meta: {
      exportValue: (row) => row.original.email,
      exportHeader: 'Mail',
    },
  },
  {
    id: 'actions',
    header: () => <p className='text-sm p-2'>Acciones</p>,
    cell: ({ row }) => {
      return (
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='icon' asChild>
            <Link href={`/admin/users/${row.original.id}/edit`}>
              <Edit className='size-4' />
            </Link>
          </Button>
          <DeleteUserModal user={row.original} />
        </div>
      );
    },
    meta: {
      exportValue: () => '',
      exportHeader: '',
    },
  },
];
