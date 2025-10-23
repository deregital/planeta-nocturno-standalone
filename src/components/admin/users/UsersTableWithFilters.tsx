'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SessionProvider } from 'next-auth/react';

import { userColumns } from '@/components/admin/users/UserColumns';
import { DataTable } from '@/components/common/DataTable';
import { type RouterOutputs } from '@/server/routers/app';
import { Input } from '@/components/ui/input';
import { role as roleEnum } from '@/drizzle/schema';
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from '@/components/ui/select';
import { roleTranslation } from '@/lib/translations';
import { Button } from '@/components/ui/button';

interface UsersTableProps {
  data: RouterOutputs['user']['getAll'];
}

export function UsersTableWithFilters({ data }: UsersTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRole, setSelectedRole] = useState<
    'all' | (typeof roleEnum.enumValues)[number]
  >('all');
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (!globalFilter && !selectedRole) return true;

      const searchValue = globalFilter
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const searchableFields = [
        item.dni,
        item.fullName,
        item.phoneNumber,
        item.email,
      ].filter(Boolean);

      return searchableFields.some((field) => {
        const normalizedField = String(field)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return (
          normalizedField.includes(searchValue) &&
          (selectedRole !== 'all' ? item.role === selectedRole : true)
        );
      });
    });
  }, [data, globalFilter, selectedRole]);

  return (
    <div className='space-y-4'>
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
            <p className='text-sm text-accent'>Filtrar por rol</p>
            <Select
              value={selectedRole}
              onValueChange={(value) =>
                setSelectedRole(
                  value === 'all'
                    ? 'all'
                    : (value as (typeof roleEnum.enumValues)[number]),
                )
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Selecciona un rol' />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem disabled value='all'>
                    Filtrar por rol
                  </SelectItem>
                  {roleEnum.enumValues.map((role) => (
                    <SelectItem key={role} value={role}>
                      {
                        roleTranslation[
                          role as (typeof roleEnum.enumValues)[number]
                        ]
                      }
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {(globalFilter || selectedRole !== 'all') && (
            <Button
              variant={'ghost'}
              size={'icon'}
              className='place-self-end -mx-4'
              onClick={() => {
                setGlobalFilter('');
                setSelectedRole('all');
              }}
            >
              <X className='size-4' />
            </Button>
          )}
          <p className='text-sm text-accent pt-4'>
            {filteredData.length} de {data.length} resultados
          </p>
        </div>
      </div>
      <SessionProvider>
        <DataTable
          fullWidth={true}
          columns={userColumns}
          data={filteredData}
          exportFileName={`Usuarios`}
        />
      </SessionProvider>
    </div>
  );
}
