'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type TicketType } from '@/server/types';
import { trpc } from '@/server/trpc/client';
import { TicketTableSection } from '@/components/event/individual/ticketsTable/TicketTableSection';

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
    parseAsString.withDefault(ticketTypes[0].name),
  );

  return (
    <>
      <Tabs
        className='w-full mt-4 overflow-x-hidden'
        onValueChange={(v) => setTab(v)}
        defaultValue={tab}
      >
        <TabsList className='flex-1 w-full md:max-w-[98%] max-w-[95%] mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
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
