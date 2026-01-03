'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

import { SearchTickets } from '@/components/event/individual/SearchTickets';
import { TicketTableSection } from '@/components/event/individual/ticketsTable/TicketTableSection';
import { TicketTableSectionChief } from '@/components/event/individual/ticketsTable/TicketTableSectionChief';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/server/trpc/client';
import { type TicketType } from '@/server/types';

export function TicketTableWithTabs({
  ticketTypes,
  externalSearchValue,
}: {
  ticketTypes: TicketType[];
  externalSearchValue?: string;
}) {
  const { data: tickets } = trpc.emittedTickets.getByEventId.useQuery(
    {
      eventId: ticketTypes[0].eventId,
    },
    {
      enabled: !!ticketTypes,
    },
  );

  const session = useSession();
  const isAdmin = session.data?.user.role === 'ADMIN';

  const [filteredTickets, setFilteredTickets] = useState<
    typeof tickets | undefined
  >(tickets);

  // Sync filtered tickets when tickets change (initial load)
  useEffect(() => {
    if (tickets) {
      setFilteredTickets(tickets);
    }
  }, [tickets]);

  const ticketsByType = useMemo(() => {
    if (!filteredTickets) return {};
    return ticketTypes?.reduce(
      (acc, type) => {
        const ticketsByType = filteredTickets.filter(
          (ticket) => ticket.ticketType.id === type.id,
        );
        acc[type.name] = [...ticketsByType];
        return acc;
      },
      {} as Record<string, typeof filteredTickets>,
    );
  }, [filteredTickets, ticketTypes]);

  const [tab, setTab] = useState(ticketTypes[0].name);

  return (
    <>
      <SearchTickets
        tickets={tickets}
        onFilteredTicketsChange={setFilteredTickets}
        externalSearchValue={externalSearchValue}
      />

      <Tabs
        className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mt-4 overflow-x-hidden'
        onValueChange={(v) => setTab(v)}
        value={tab}
      >
        <TabsList className='flex-1 w-full md:max-w-[98%] max-w-[98%] mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
          {Object.keys(ticketsByType).map((type) => (
            <TabsTrigger className='min-w-2xs px-4' key={type} value={type}>
              {type}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(ticketsByType).map((type) => (
          <TabsContent key={type} value={type}>
            {session.data?.user.role === 'CHIEF_ORGANIZER' ? (
              <TicketTableSectionChief tickets={ticketsByType[type]} />
            ) : (
              <TicketTableSection
                tickets={ticketsByType[type]}
                isAdmin={isAdmin}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
