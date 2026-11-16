'use client';

import { QrCode, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import EventCheckboxRow from '@/components/admin/ticketing/EventCheckboxRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { eventMatchesFilters } from '@/lib/event-filters';
import { isWithin24Hours } from '@/lib/utils-client';
import { trpc } from '@/server/trpc/client';

export default function TicketingPage() {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: events = [], isLoading } =
    trpc.events.getAllForTicketing.useQuery();

  const listed = showAll ? events : events.filter(isWithin24Hours);
  const visible = listed.filter((event) =>
    eventMatchesFilters(event, { query }),
  );
  // "Seleccionar todos" sólo existe en la vista de próximos y toca los que se
  // ven ahora (respeta la búsqueda). Con "Mostrar todos" no se ofrece, para
  // no confundir sobre qué eventos marca.
  const visibleUpcomingIds = showAll ? [] : visible.map((event) => event.id);
  const allUpcomingSelected =
    visibleUpcomingIds.length > 0 &&
    visibleUpcomingIds.every((id) => selectedIds.has(id));

  function handleCheckedChange(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleUpcoming() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleUpcomingIds) {
        if (allUpcomingSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/ticketing/scan?ids=${[...selectedIds].join(',')}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col gap-6 p-4 max-w-lg mx-auto w-full'
    >
      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
        <h1 className='text-2xl font-bold text-accent'>Escanear Tickets</h1>
        <button
          type='button'
          onClick={() => setShowAll((prev) => !prev)}
          className='text-sm text-accent-dark/60 hover:text-accent transition-colors underline underline-offset-2 cursor-pointer'
        >
          {showAll ? 'Mostrar próximos' : 'Mostrar todos'}
        </button>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent/50' />
          <Input
            type='search'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // El campo está dentro del form: Enter no tiene que arrancar el
              // escaneo, sólo cerrar el teclado.
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder='Buscar evento'
            aria-label='Buscar evento por nombre'
            enterKeyHint='search'
            className='pl-9'
          />
        </div>

        {visibleUpcomingIds.length > 0 && (
          <button
            type='button'
            onClick={toggleUpcoming}
            className='self-start text-sm text-accent font-medium underline underline-offset-2 cursor-pointer'
          >
            {allUpcomingSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        {isLoading ? (
          <p className='text-accent-dark/50 text-sm'>Cargando eventos...</p>
        ) : visible.length === 0 ? (
          <p className='text-accent-dark/50 text-sm break-words'>
            {listed.length > 0
              ? `No hay eventos que se llamen "${query.trim()}".`
              : showAll
                ? 'No hay eventos.'
                : 'No hay eventos para hoy ni mañana.'}
          </p>
        ) : (
          visible.map((event) => (
            <EventCheckboxRow
              key={event.id}
              event={event}
              checked={selectedIds.has(event.id)}
              onCheckedChange={(checked) =>
                handleCheckedChange(event.id, checked as boolean)
              }
            />
          ))
        )}
      </div>

      <div className='sticky bottom-4 z-10'>
        <Button
          type='submit'
          variant='accent'
          className='w-full py-6 text-base gap-2'
          disabled={isLoading || selectedIds.size === 0}
        >
          <QrCode className='size-5' />
          {selectedIds.size > 1
            ? `Iniciar escaneo (${selectedIds.size})`
            : 'Iniciar escaneo'}
        </Button>
      </div>
    </form>
  );
}
