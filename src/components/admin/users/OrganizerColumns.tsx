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
          <span>{row.original.shortId}</span>
        </div>
      );
    },
    meta: {
      exportValue: (row) => row.original.id,
      exportHeader: 'ID',
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
    accessorKey: 'instagram',
    header: () => <p className='text-sm p-2'>Instagram</p>,
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
          <TagModal type='CREATE' />
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
