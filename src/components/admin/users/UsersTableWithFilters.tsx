'use client';

import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { organizerColumns } from '@/components/admin/users/OrganizerColumns';
import { DataTable } from '@/components/common/DataTable';
import { MultiSelect } from '@/components/common/MultiSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { roleTranslation } from '@/lib/translations';
import { type RouterOutputs } from '@/server/routers/app';

interface UsersTableProps {
  data:
    | RouterOutputs['user']['getAll']
    | RouterOutputs['user']['getOrganizers'];
  onClickRow?: (id: string) => void;
}

export function UsersTableWithFilters({ data, onClickRow }: UsersTableProps) {
  const router = useRouter();
  const session = useSession();
  const isAdmin = session.data?.user.role === 'ADMIN';

  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

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

  // Create role options for admin
  const roleOptions = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        value: 'ORGANIZER',
        label: roleTranslation['ORGANIZER'],
      },
      {
        value: 'CHIEF_ORGANIZER',
        label: roleTranslation['CHIEF_ORGANIZER'],
      },
    ];
  }, [isAdmin]);

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

      const matchesBatch =
        selectedBatches.length === 0 ||
        item.userXTags.some(({ tag }) => selectedBatches.includes(tag.name));

      const matchesRole =
        !isAdmin ||
        selectedRoles.length === 0 ||
        selectedRoles.includes(item.role);

      return matchesSearch && matchesBatch && matchesRole;
    });
  }, [data, globalFilter, selectedBatches, selectedRoles, isAdmin]);

  const handleRowClick = (id: string) => {
    if (onClickRow) {
      onClickRow(id);
    } else {
      router.push(`/admin/users/${id}`);
    }
  };

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
            {isAdmin && (
              <MultiSelect
                className='w-full min-w-48'
                options={roleOptions}
                selectedValues={selectedRoles}
                onSelectionChange={setSelectedRoles}
                label='Filtrar por rol'
                placeholder='Todos los roles'
                emptyMessage='No hay roles disponibles'
              />
            )}
            <MultiSelect
              className='w-full'
              options={availableBatches}
              selectedValues={selectedBatches}
              onSelectionChange={setSelectedBatches}
              label='Filtrar por grupo'
              placeholder='Todos los grupos'
              emptyMessage='No hay grupos disponibles'
            />
          </div>
          <div className='flex flex-row items-center gap-2 pt-4 md:pt-0 md:place-self-end'>
            <p className='text-sm text-accent'>
              {filteredData.length} de {data.length} resultados
            </p>
            {(globalFilter ||
              selectedBatches.length > 0 ||
              selectedRoles.length > 0) && (
              <Button
                variant={'ghost'}
                size={'icon'}
                className='mx-2'
                onClick={() => {
                  setGlobalFilter('');
                  setSelectedBatches([]);
                  setSelectedRoles([]);
                }}
              >
                <X className='size-4' />
              </Button>
            )}
          </div>
        </div>
      </div>
      <DataTable
        fullWidth={true}
        columns={organizerColumns}
        data={filteredData}
        exportFileName={`Usuarios`}
        onClickRow={handleRowClick}
        requirePasswordForExport={true}
      />
    </div>
  );
}
