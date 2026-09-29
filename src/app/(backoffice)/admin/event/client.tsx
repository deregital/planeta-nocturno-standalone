'use client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@radix-ui/react-accordion';
import { Calendar, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

import ActiveEventsOrder from '@/components/events/admin/ActiveEventsOrder';
import EventFolderModal from '@/components/events/admin/EventFolderModal';
import EventList from '@/components/events/admin/EventList';
import EventSearch from '@/components/events/admin/EventSearch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  eventGroupHasEvents,
  filterEventGroup,
  hasActiveEventFilters,
  type EventFilters,
} from '@/lib/event-filters';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  events,
}: {
  events: RouterOutputs['events']['getAll'];
}) {
  const session = useSession();
  const router = useRouter();
  const [filters, setFilters] = useState<EventFilters>({ query: '' });

  const upcomingEvents = useMemo(
    () => filterEventGroup(events.upcomingEvents, filters),
    [events.upcomingEvents, filters],
  );
  const pastEvents = useMemo(
    () => filterEventGroup(events.pastEvents, filters),
    [events.pastEvents, filters],
  );

  const [pastOpen, setPastOpen] = useState('');
  const isFiltering = hasActiveEventFilters(filters);
  const hasUpcoming = eventGroupHasEvents(upcomingEvents);
  const hasPast = eventGroupHasEvents(pastEvents);

  useEffect(() => {
    if (isFiltering && hasPast) {
      setPastOpen('item-1');
    }
  }, [isFiltering, hasPast]);

  return (
    <div className='flex w-full p-4 flex-col gap-6'>
      <h1 className='text-3xl font-bold text-accent'>Gestor de Eventos</h1>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        {session.data?.user.role === 'ADMIN' && (
          <div className='flex gap-2'>
            <Button
              className='w-fit py-4 px-8'
              onClick={() => router.push('/admin/event/create')}
            >
              <Calendar /> Crear evento
            </Button>
            <EventFolderModal action='CREATE' />
          </div>
        )}
        <EventSearch filters={filters} onFiltersChange={setFilters} />
      </div>

      <p className='text-2xl font-bold text-accent'>Próximos Eventos</p>
      {hasUpcoming || !isFiltering ? (
        <EventList events={upcomingEvents} />
      ) : (
        <p className='text-lg font-medium text-accent'>
          No se encontraron eventos próximos
        </p>
      )}
      {session.data?.user.role === 'ADMIN' && !isFiltering && (
        <>
          <Separator className='border rounded-full border-accent-light' />
          <Accordion type='single' collapsible className='w-full'>
            <AccordionItem value='item-1' className='border-none'>
              <AccordionTrigger className='cursor-pointer hover:no-underline py-4 px-0 group gap-2 transition-all duration-200 ease-in-out hover:bg-gray-50/50 rounded-lg flex items-center justify-between'>
                <p className='text-2xl font-bold text-accent group-hover:text-accent/80 transition-colors duration-200'>
                  Orden en la ticketera
                </p>
                <ChevronDown className='h-6 w-6 text-accent transition-transform duration-200 group-data-[state=open]:rotate-180' />
              </AccordionTrigger>
              <AccordionContent className='overflow-hidden transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'>
                <div className='pt-4 pb-2'>
                  <ActiveEventsOrder />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
      {(!isFiltering || hasPast) && (
        <>
          <Separator className='border rounded-full border-accent-light' />
          <Accordion
            type='single'
            collapsible
            className='w-full'
            value={pastOpen}
            onValueChange={setPastOpen}
          >
            <AccordionItem value='item-1' className='border-none'>
              <AccordionTrigger className='cursor-pointer hover:no-underline py-4 px-0 group gap-2 transition-all duration-200 ease-in-out hover:bg-gray-50/50 rounded-lg flex items-center justify-between'>
                <p className='text-2xl font-bold text-accent group-hover:text-accent/80 transition-colors duration-200'>
                  Eventos Pasados
                </p>
                <ChevronDown className='h-6 w-6 text-accent transition-transform duration-200 group-data-[state=open]:rotate-180' />
              </AccordionTrigger>
              <AccordionContent className='overflow-hidden transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'>
                <div className='pt-4 pb-2'>
                  <EventList events={pastEvents} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
}
