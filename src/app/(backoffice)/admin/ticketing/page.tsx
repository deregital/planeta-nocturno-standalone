'use client';

import { QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import EventCheckboxRow from '@/components/admin/ticketing/EventCheckboxRow';
import { Button } from '@/components/ui/button';
import { isSoon } from '@/lib/utils-client';
import { trpc } from '@/server/trpc/client';

export default function TicketingPage() {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: events = [], isLoading } =
    trpc.events.getAllForTicketing.useQuery();

  const filtered = showAll ? events : events.filter(isSoon);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/ticketing/scan?ids=${[...selectedIds].join(',')}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col gap-6 p-4 max-w-lg mx-auto w-full'
    >
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-accent'>Escanear Tickets</h1>
        <button
          type='button'
          onClick={() => setShowAll((prev) => !prev)}
          className='text-sm text-accent-dark/60 hover:text-accent transition-colors underline underline-offset-2 cursor-pointer'
        >
          {showAll ? 'Mostrar próximos' : 'Mostrar todos'}
        </button>
      </div>

      <div className='flex flex-col gap-2'>
        {isLoading ? (
          <p className='text-accent-dark/50 text-sm'>Cargando eventos...</p>
        ) : filtered.length === 0 ? (
          <p className='text-accent-dark/50 text-sm'>
            {showAll ? 'No hay eventos.' : 'No hay eventos para hoy ni mañana.'}
          </p>
        ) : (
          filtered.map((event) => (
            <EventCheckboxRow
              key={event.id}
              event={event}
              onCheckedChange={(checked) =>
                handleCheckedChange(event.id, checked as boolean)
              }
            />
          ))
        )}
      </div>

      <div className='sticky bottom-4'>
        <Button
          type='submit'
          variant='accent'
          className='w-full py-6 text-base gap-2'
          disabled={isLoading || selectedIds.size === 0}
        >
          <QrCode className='size-5' />
          Iniciar escaneo
        </Button>
      </div>
    </form>
  );
}
