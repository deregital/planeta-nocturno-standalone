'use client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import EventList from '@/components/events/admin/EventList';
import EventSearch from '@/components/events/admin/EventSearch';
import { Separator } from '@/components/ui/separator';
import {
  eventGroupHasEvents,
  filterEventGroup,
  hasActiveEventFilters,
  type EventFilters,
} from '@/lib/event-filters';
import { type RouterOutputs } from '@/server/routers/app';

type OrganizerEvent =
  RouterOutputs['organizer']['getMyEvents'][number]['event'];

function toEventList(events: OrganizerEvent[]) {
  return {
    folders: [],
    withoutFolders: events,
  };
}

export default function Client({
  upcomingEvents,
  pastEvents,
}: {
  upcomingEvents: OrganizerEvent[];
  pastEvents: OrganizerEvent[];
}) {
  const [filters, setFilters] = useState<EventFilters>({ query: '' });
  const [pastOpen, setPastOpen] = useState('');

  const filteredUpcoming = useMemo(
    () => filterEventGroup(toEventList(upcomingEvents), filters),
    [upcomingEvents, filters],
  );
  const filteredPast = useMemo(
    () => filterEventGroup(toEventList(pastEvents), filters),
    [pastEvents, filters],
  );

  const isFiltering = hasActiveEventFilters(filters);
  const hasUpcoming = eventGroupHasEvents(filteredUpcoming);
  const hasPast = eventGroupHasEvents(filteredPast);

  useEffect(() => {
    if (isFiltering && hasPast) {
      setPastOpen('item-1');
    }
  }, [isFiltering, hasPast]);

  return (
    <div className='flex flex-col gap-4 p-4'>
      <EventSearch filters={filters} onFiltersChange={setFilters} />
      <p className='text-2xl font-bold text-accent'>Próximos Eventos</p>
      {hasUpcoming ? (
        <EventList
          events={filteredUpcoming}
          showActions={false}
          href={(slug: string) => `/organization/event/${slug}`}
        />
      ) : (
        <p className='text-lg font-medium text-accent'>
          {isFiltering
            ? 'No se encontraron eventos próximos'
            : 'No tenés eventos próximos'}
        </p>
      )}
      {hasPast && (
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
              <AccordionTrigger className='bg-transparent cursor-pointer hover:no-underline py-4 px-0 group gap-2 transition-all duration-200 ease-in-out hover:bg-gray-50/50 rounded-lg flex items-center justify-start'>
                <p className='text-2xl font-bold text-accent group-hover:text-accent/80 transition-colors duration-200'>
                  Eventos Pasados
                </p>
                <ChevronDown className='h-6 w-6 text-accent transition-transform duration-200 group-data-[state=open]:rotate-180' />
              </AccordionTrigger>
              <AccordionContent className='overflow-hidden transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'>
                <div className='pt-4 pb-2'>
                  <EventList
                    events={filteredPast}
                    showActions={false}
                    href={(slug: string) => `/organization/event/${slug}`}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
}
