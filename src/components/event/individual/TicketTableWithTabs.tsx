'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type RouterOutputs } from '@/server/routers/app';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { TicketTableSection } from './ticketsTable/TicketTableSection';
import { type TicketType } from '@/server/types';

export function TicketTableWithTabs({
  tickets,
  ticketTypes,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
  ticketTypes: TicketType[];
}) {
  const ticketsByType = useMemo(
    () =>
      ticketTypes?.reduce(
        (acc, type) => {
          const ticketsByType = tickets.filter(
            (ticket) => ticket.ticketType.id === type.id,
          );
          acc[type.name] = ticketsByType;
          return acc;
        },
        {} as Record<string, typeof tickets>,
      ),
    [tickets, ticketTypes],
  );

  const [tab, setTab] = useQueryState<string>(
    'tab',
    parseAsString.withDefault(Object.keys(ticketsByType)[0]),
  );

  return (
    <>
      <Tabs
        className='w-full mt-4'
        onValueChange={(v) => setTab(v)}
        defaultValue={tab}
      >
        <TabsList className='w-[100vw] overflow-x-auto [scrollbar-width:thin] justify-start'>
          {Object.keys(ticketsByType).map((type) => (
            <TabsTrigger className='min-w-2xs px-4' key={type} value={type}>
              {type}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(ticketsByType).map((type) => (
          <TabsContent key={type} value={type}>
            <TicketTableSection tickets={ticketsByType[type]} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
