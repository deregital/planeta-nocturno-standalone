'use client';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { type EventFilters } from '@/lib/event-filters';

export default function EventSearch({
  filters,
  onFiltersChange,
}: {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
}) {
  return (
    <div className='relative w-full max-w-md'>
      <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent/50' />
      <Input
        placeholder='Buscar evento'
        value={filters.query ?? ''}
        onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
        className='pl-10'
      />
    </div>
  );
}
