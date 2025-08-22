'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { TicketTableSection } from './ticketsTable/TicketTableSection';
import { type TicketType } from '@/server/types';
import { trpc } from '@/server/trpc/client';

export function TicketTableWithTabs({
  ticketTypes,
}: {
  ticketTypes: TicketType[];
}) {
  const { data: tickets } = trpc.emittedTickets.getByEventId.useQuery(
    {
      eventId: ticketTypes[0].eventId,
    },
    {
      enabled: !!ticketTypes,
    },
  );

  const ticketsByType = useMemo(() => {
    if (!tickets) return {};
    return ticketTypes?.reduce(
      (acc, type) => {
        const ticketsByType = tickets.filter(
          (ticket) => ticket.ticketType.id === type.id,
        );
        acc[type.name] = [...ticketsByType];
        return acc;
      },
      {} as Record<string, typeof tickets>,
    );
  }, [tickets, ticketTypes]);

  const [tab, setTab] = useQueryState<string>(
    'tab',
    parseAsString.withDefault(Object.keys(ticketsByType)[0]),
  );

  return (
    <>
      <Tabs
        className='w-full mt-4 overflow-x-hidden'
        onValueChange={(v) => setTab(v)}
        defaultValue={tab}
      >
        <TabsList className='flex-1 w-full md:max-w-[98vw] max-w-[95vw] mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
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
