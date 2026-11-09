'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { organizerColumns } from '@/components/admin/users/OrganizerColumns';
import { DataTable } from '@/components/common/DataTable';
import { MultiSelect } from '@/components/common/MultiSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIRTH_MONTH_OPTIONS, tryDateOnlyToLocalDate } from '@/lib/date-only';
import { type RouterOutputs } from '@/server/routers/app';

interface UsersTableProps {
  data:
    | RouterOutputs['user']['getOrganizers']
    | RouterOutputs['user']['getOrganizersByChiefOrganizer'];
  onClickRow?: (id: string) => void;
}

export function UsersTableWithFilters({ data, onClickRow }: UsersTableProps) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('0');

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

  const roleOptions = useMemo(
    () =>
      [...new Set(data.map((user) => user.accessRole.name))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((name) => ({ value: name, label: name })),
    [data],
  );
  const canFilterByRole = roleOptions.length > 1;

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
            item.user?.fullName,
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
        !canFilterByRole ||
        selectedRoles.length === 0 ||
        selectedRoles.includes(item.accessRole.name);

      const matchesMonth =
        selectedMonth === '0' ||
        tryDateOnlyToLocalDate(item.birthDate)?.getMonth() ===
          Number(selectedMonth) - 1;

      return matchesSearch && matchesBatch && matchesRole && matchesMonth;
    });
  }, [
    data,
    globalFilter,
    selectedBatches,
    selectedRoles,
    canFilterByRole,
    selectedMonth,
  ]);

  const handleRowClick = (id: string) => {
    if (onClickRow) {
      onClickRow(id);
    } else {
      router.push(`/admin/users/${id}`);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='px-4'>
        <div className='flex w-full min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-start'>
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
          <div className='flex w-full flex-row items-end gap-4 md:w-auto'>
            {canFilterByRole && (
              <MultiSelect
                className='min-w-0 flex-1 sm:min-w-48 sm:flex-none'
                options={roleOptions}
                selectedValues={selectedRoles}
                onSelectionChange={setSelectedRoles}
                label='Filtrar por rol'
                placeholder='Todos los roles'
                emptyMessage='No hay roles disponibles'
              />
            )}
            <MultiSelect
              className='min-w-0 flex-1 sm:min-w-48 sm:flex-none'
              options={availableBatches}
              selectedValues={selectedBatches}
              onSelectionChange={setSelectedBatches}
              label='Filtrar por grupo'
              placeholder='Todos los grupos'
              emptyMessage='No hay grupos disponibles'
            />
            <div className='flex min-w-0 flex-1 flex-col sm:flex-none'>
              <p className='text-sm text-accent truncate'>
                Filtrar por mes de nacimiento
              </p>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className='w-full sm:min-w-48'>
                  <SelectValue placeholder='Filtrar por mes de nacimiento' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Mes de nacimiento</SelectLabel>
                    {BIRTH_MONTH_OPTIONS.map((month, index) => (
                      <SelectItem key={month} value={String(index)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='flex flex-row items-center gap-2 sm:pt-0 md:place-self-end'>
            <p className='text-sm text-accent'>
              {filteredData.length} de {data.length} resultados
            </p>
            {(globalFilter ||
              selectedBatches.length > 0 ||
              selectedRoles.length > 0 ||
              selectedMonth !== '0') && (
              <Button
                variant={'ghost'}
                size={'icon'}
                className='mx-2'
                onClick={() => {
                  setGlobalFilter('');
                  setSelectedBatches([]);
                  setSelectedRoles([]);
                  setSelectedMonth('0');
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
        exportPermission='exports:organizers'
      />
    </div>
  );
}
