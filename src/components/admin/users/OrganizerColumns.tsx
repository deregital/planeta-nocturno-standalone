'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { differenceInYears } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { format as formatPhoneNumber } from 'libphonenumber-js';
import { ArrowDown, ArrowUp, ArrowUpDown, Cake } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { AddTag } from '@/components/admin/users/AddTag';
import { DeleteUserModal } from '@/components/admin/users/DeleteUserModal';
import EditOrganizerForm from '@/components/admin/users/EditOrganizerForm';
import { ResetPasswordForm } from '@/components/admin/users/ResetPasswordForm';
import { TagModal } from '@/components/admin/users/TagModal';
import { Button } from '@/components/ui/button';
import { genderTranslation } from '@/lib/translations';
import { daysUntilBirthday } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

export const organizerColumns: StrictColumnDef<
  RouterOutputs['user']['getAll'][number]
>[] = [
  {
    id: 'shortId',
    accessorKey: 'shortId',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
          style={{
            width: `${column.getSize()}px`,
          }}
        >
          ID
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    minSize: 50,
    size: 50,
    maxSize: 50,
    enableResizing: false,
    cell: ({ row }) => {
      return (
        <div className='text-sm'>
          <span>{row.original.shortId}</span>
        </div>
      );
    },
    meta: {
      exportValue: (row) => row.original.id,
      exportHeader: 'ID',
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = Number(rowA.getValue(columnId)) || 0;
      const b = Number(rowB.getValue(columnId)) || 0;
      return a - b;
    },
  },
  {
    accessorKey: 'fullName',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Nombre
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    cell: ({ row }) => {
      const fullName = row.original.fullName;
      return <p className='text-sm p-2'>{fullName}</p>;
    },
    meta: {
      exportValue: (row) => row.original.fullName,
      exportHeader: 'Nombre',
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = String(rowA.getValue(columnId) || '').toLowerCase();
      const b = String(rowB.getValue(columnId) || '').toLowerCase();
      return a.localeCompare(b);
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
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Edad
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
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
    sortingFn: (rowA, rowB) => {
      const ageA = differenceInYears(
        new Date(),
        new Date(rowA.original.birthDate),
      );
      const ageB = differenceInYears(
        new Date(),
        new Date(rowB.original.birthDate),
      );
      return ageA - ageB;
    },
  },
  {
    id: 'dni',
    accessorKey: 'dni',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          DNI/Pasaporte
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    cell: ({ row }) => {
      return <p className='text-sm p-2'>{row.original.dni}</p>;
    },
    meta: {
      exportValue: (row) => row.original.dni,
      exportHeader: 'DNI/Pasaporte',
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = String(rowA.getValue(columnId) || '').toLowerCase();
      const b = String(rowB.getValue(columnId) || '').toLowerCase();
      return a.localeCompare(b);
    },
  },
  {
    id: 'gender',
    accessorKey: 'gender',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Género
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    meta: {
      exportValue: (row) => {
        const gender = row.original.gender;
        return gender
          ? genderTranslation[gender as keyof typeof genderTranslation]
          : '-';
      },
      exportHeader: 'Género',
    },
    sortingFn: (rowA, rowB) => {
      const genderA = rowA.original.gender;
      const genderB = rowB.original.gender;
      const a = genderA
        ? genderTranslation[genderA as keyof typeof genderTranslation]
        : '-';
      const b = genderB
        ? genderTranslation[genderB as keyof typeof genderTranslation]
        : '-';
      return a.localeCompare(b);
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
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Teléfono
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
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
    sortingFn: (rowA, rowB, columnId) => {
      const a = String(rowA.getValue(columnId) || '').toLowerCase();
      const b = String(rowB.getValue(columnId) || '').toLowerCase();
      return a.localeCompare(b);
    },
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Mail
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    cell: ({ row, column }) => {
      const mail = row.original.email;
      return (
        <p
          className='text-sm p-2 truncate'
          title={mail}
          style={{ width: `${column.getSize()}px`, whiteSpace: 'nowrap' }}
        >
          {mail}
        </p>
      );
    },
    minSize: 100,
    maxSize: 200,
    size: 200,
    enableResizing: false,
    meta: {
      exportValue: (row) => row.original.email,
      exportHeader: 'Mail',
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = String(rowA.getValue(columnId) || '').toLowerCase();
      const b = String(rowB.getValue(columnId) || '').toLowerCase();
      return a.localeCompare(b);
    },
  },
  {
    accessorKey: 'instagram',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Instagram
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    cell: ({ row }) => {
      const instagram = row.original.instagram;
      return instagram ? (
        <a
          href={`https://instagram.com/${instagram}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-sm p-2 underline text-blue-500 hover:text-blue-500/75'
        >
          @{instagram}
        </a>
      ) : (
        <p className='text-sm p-2'>-</p>
      );
    },
    meta: {
      exportValue: (row) => row.original.instagram || '-',
      exportHeader: 'Instagram',
    },
    sortingFn: (rowA, rowB, columnId) => {
      const a = String(rowA.getValue(columnId) || '').toLowerCase();
      const b = String(rowB.getValue(columnId) || '').toLowerCase();
      return a.localeCompare(b);
    },
  },

  {
    accessorKey: 'chiefOrganizerFullName',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className='flex items-center gap-2 font-bold'
        >
          Jefe del Organizador
          {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
          {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
          {!sorted && <ArrowUpDown className='h-4 w-4' />}
        </Button>
      );
    },
    cell: ({ row }) => {
      const chiefFullName = row.original.user?.fullName;
      return <p className='text-sm p-2'>{chiefFullName ?? '-'}</p>;
    },
    meta: {
      exportValue: (row) => row.original.user?.fullName ?? '-',
      exportHeader: 'Jefe del Organizador',
    },
    sortingFn: (rowA, rowB) => {
      const a = String(rowA.original.user?.fullName || '-').toLowerCase();
      const b = String(rowB.original.user?.fullName || '-').toLowerCase();
      return a.localeCompare(b);
    },
  },
  {
    accessorKey: 'tags',
    header: ({ column }) => {
      const sorted = column.getIsSorted();
      return (
        <div className='flex items-center'>
          <Button
            variant='ghost'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className='flex items-center font-bold'
          >
            <span className='text-sm'>Grupo</span>
            {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
            {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
            {!sorted && <ArrowUpDown className='h-4 w-4' />}
          </Button>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const batchesA = rowA.original.userXTags
        .map(({ tag }) => tag.name)
        .sort()
        .join(', ');
      const batchesB = rowB.original.userXTags
        .map(({ tag }) => tag.name)
        .sort()
        .join(', ');
      if (!batchesA && !batchesB) return 0;
      if (!batchesA) return 1;
      if (!batchesB) return -1;
      return batchesA.localeCompare(batchesB);
    },
    cell: ({ row }) => {
      const currentUserTagIds = row.original.userXTags.map(({ tag }) => tag.id);
      return (
        <div
          className='flex flex-wrap gap-1'
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.userXTags.map(({ tag }) => (
            <TagModal
              type='EDIT'
              key={tag.id}
              userId={row.original.id}
              tag={tag}
            />
          ))}
          <AddTag
            userId={row.original.id}
            currentUserTagIds={currentUserTagIds}
          />
        </div>
      );
    },
    meta: {
      exportValue: (row) =>
        row.original.userXTags.map(({ tag }) => tag.name).join(', '),
      exportHeader: 'Grupo',
    },
  },
  {
    id: 'actions',
    header: () => <p className='text-sm p-2'>Acciones</p>,
    cell: ({ row }) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const session = useSession();
      if (session.data?.user.id === row.original.id) return null;
      return (
        <div
          className='flex items-center gap-2'
          onClick={(e) => e.stopPropagation()}
        >
          <EditOrganizerForm organizer={row.original} />
          <ResetPasswordForm
            userId={row.original.id}
            userName={row.original.name}
            userRole={row.original.role}
          />
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
