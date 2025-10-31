'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SessionProvider } from 'next-auth/react';

import { userColumns } from '@/components/admin/users/UserColumns';
import { DataTable } from '@/components/common/DataTable';
import { type RouterOutputs } from '@/server/routers/app';
import { Input } from '@/components/ui/input';
import { role as roleEnum } from '@/drizzle/schema';
import { roleTranslation } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/common/MultiSelect';

interface UsersTableProps {
  data: RouterOutputs['user']['getAll'];
}

export function UsersTableWithFilters({ data }: UsersTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  // Extract all unique batches from data
  const availableBatches = useMemo(() => {
    const batchSet = new Set<string>();
    data.forEach((user) => {
      user.userXTags.forEach(({ tag }) => {
        batchSet.add(tag.name);
      });
    });
    return Array.from(batchSet)
      .sort()
      .map((batch) => ({ value: batch, label: batch }));
  }, [data]);

  // Create role options
  const roleOptions = useMemo(() => {
    return roleEnum.enumValues.map((role) => ({
      value: role,
      label: roleTranslation[role as (typeof roleEnum.enumValues)[number]],
    }));
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        !globalFilter ||
        (() => {
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
            return normalizedField.includes(searchValue);
          });
        })();

      const matchesRole =
        selectedRoles.length === 0 || selectedRoles.includes(item.role);

      const matchesBatch =
        selectedBatches.length === 0 ||
        item.userXTags.some(({ tag }) => selectedBatches.includes(tag.name));

      return matchesSearch && matchesRole && matchesBatch;
    });
  }, [data, globalFilter, selectedRoles, selectedBatches]);

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between px-4'>
        <div className='flex md:items-center justify-start w-full gap-4 flex-col md:flex-row'>
          <div className='md:w-80 w-full'>
            <p className='text-sm text-accent truncate'>
              Filtrar por nombre, DNI, teléfono, mail o Instagram
            </p>
            <Input
              placeholder='Nombre, DNI, mail...'
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className='max-full self-end'
            />
          </div>
          <div className='flex flex-row md:items-center gap-4 w-full md:w-auto'>
            <MultiSelect
              className='w-full min-w-48'
              options={roleOptions}
              selectedValues={selectedRoles}
              onSelectionChange={setSelectedRoles}
              label='Filtrar por rol'
              placeholder='Todos los roles'
              emptyMessage='No hay roles disponibles'
            />
            <MultiSelect
              className='w-full'
              options={availableBatches}
              selectedValues={selectedBatches}
              onSelectionChange={setSelectedBatches}
              label='Filtrar por batch'
              placeholder='Todos los batches'
              emptyMessage='No hay batches disponibles'
            />
          </div>
          <div className='flex flex-row items-center gap-2 pt-4 md:pt-0 md:place-self-end'>
            <p className='text-sm text-accent'>
              {filteredData.length} de {data.length} resultados
            </p>
            {(globalFilter ||
              selectedRoles.length > 0 ||
              selectedBatches.length > 0) && (
              <Button
                variant={'ghost'}
                size={'icon'}
                className='mx-2'
                onClick={() => {
                  setGlobalFilter('');
                  setSelectedRoles([]);
                  setSelectedBatches([]);
                }}
              >
                <X className='size-4' />
              </Button>
            )}
          </div>
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
