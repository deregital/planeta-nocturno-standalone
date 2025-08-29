'use client';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';

export const dateRanges: { label: string; id: string; from: Date; to: Date }[] =
  [
    {
      label: 'Esta semana',
      id: 'esta-semana',
      from: startOfWeek(new Date()),
      to: endOfWeek(new Date()),
    },

    {
      label: 'Este mes',
      id: 'este-mes',
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
  ];

export function EventFilter() {
  const [search, setSearch] = useQueryState('q', parseAsString);
  const [dateRange, setDateRange] = useQueryState('date', parseAsString);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
  };

  const selectedDateRange = useMemo(
    () => dateRanges.find((range) => range.id === dateRange),
    [dateRange],
  );

  return (
    <div className='bg-gray-300 p-2 rounded-md w-full flex-col flex'>
      <div className='flex gap-2'>
        <div className='relative flex-1'>
          <Input
            placeholder='Buscar evento'
            value={search ?? ''}
            onChange={handleSearch}
          />
          <SearchIcon className='absolute right-2 top-1/2 size-4 text-accent/50 -translate-y-1/2' />
        </div>
        <Select
          value={selectedDateRange?.id}
          onValueChange={(value) => {
            const selectedValue = dateRanges.find(
              (range) => range.id === value,
            );

            handleDateRangeChange(selectedValue?.id ?? '');
          }}
        >
          <SelectTrigger className='w-full md:max-w-2xs max-w-48'>
            <SelectValue placeholder='Seleccionar rango de fechas' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fecha del evento</SelectLabel>
              {dateRanges.map((range) => (
                <SelectItem key={range.id} value={range.id}>
                  {range.label}
                </SelectItem>
              ))}
              <SelectItem value='limpiar-filtro'>Limpiar filtro</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
