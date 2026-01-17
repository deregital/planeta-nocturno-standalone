'use client';

import { ClipboardIcon } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SearchTickets } from '@/components/event/individual/SearchTickets';
import { TicketTableSection } from '@/components/event/individual/ticketsTable/TicketTableSection';
import { TicketTableSectionChief } from '@/components/event/individual/ticketsTable/TicketTableSectionChief';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/server/trpc/client';
import { type TicketType } from '@/server/types';
import {
  ORGANIZER_TICKET_TYPE_NAME,
  TICKET_TYPE_SLUG_QUERY_PARAM,
} from '@/server/utils/constants';

export function TicketTableWithTabs({
  ticketTypes,
  externalSearchValue,
  userId,
  eventSlug,
}: {
  ticketTypes: TicketType[];
  externalSearchValue?: string;
  userId?: string;
  eventSlug: string;
}) {
  const { data: tickets } = trpc.emittedTickets.getByEventId.useQuery(
    {
      eventId: ticketTypes[0].eventId,
      userId,
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

  // Sort ticket types so organizer types always go to the end
  const sortedTicketTypes = useMemo(() => {
    return [...ticketTypes].sort((a, b) => {
      const aIsOrganizer = a.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim();
      const bIsOrganizer = b.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim();

      // If one is organizer and the other isn't, organizer goes to the end
      if (aIsOrganizer && !bIsOrganizer) return 1;
      if (!aIsOrganizer && bIsOrganizer) return -1;

      // Otherwise maintain original order
      return 0;
    });
  }, [ticketTypes]);

  const ticketsByType = useMemo(() => {
    if (!filteredTickets) return {};
    return sortedTicketTypes?.reduce(
      (acc, type) => {
        const ticketsByType = filteredTickets.filter(
          (ticket) => ticket.ticketType.id === type.id,
        );
        acc[type.name] = [...ticketsByType];
        return acc;
      },
      {} as Record<string, typeof filteredTickets>,
    );
  }, [filteredTickets, sortedTicketTypes]);

  const initialTab = useMemo(
    () => sortedTicketTypes[0]?.name || '',
    [sortedTicketTypes],
  );

  const [tab, setTab] = useState(() => initialTab);

  // Ensure tab is always valid - use the current tab if it exists, otherwise use the first tab
  const currentTab = useMemo(() => {
    const availableTabs = Object.keys(ticketsByType);
    return availableTabs.includes(tab) ? tab : availableTabs[0] || '';
  }, [tab, ticketsByType]);

  const copyTicketTypeUrl = (ticketTypeSlug: string) => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';
    const url = `${origin}/event/${eventSlug}?${TICKET_TYPE_SLUG_QUERY_PARAM}=${ticketTypeSlug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada al portapapeles');
  };

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
        value={currentTab}
      >
        <TabsList className='flex-1 w-full md:max-w-[98%] max-w-[98%] mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
          {Object.keys(ticketsByType).map((type) => (
            <TabsTrigger className='min-w-2xs px-4' key={type} value={type}>
              {type}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(ticketsByType).map((type) => {
          const currentTicketType = sortedTicketTypes.find(
            (tt) => tt.name === type,
          );
          const isOrganizerTicket =
            currentTicketType?.name.trim() ===
            ORGANIZER_TICKET_TYPE_NAME.trim();
          const copyButton =
            currentTicketType?.slug && !isOrganizerTicket ? (
              <Button
                variant='accent'
                className='w-fit'
                onClick={() => copyTicketTypeUrl(currentTicketType.slug)}
              >
                <ClipboardIcon className='w-4 h-4 mr-2' />
                Copiar URL de este tipo de ticket
              </Button>
            ) : null;

          return (
            <TabsContent key={type} value={type}>
              {session.data?.user.role === 'CHIEF_ORGANIZER' ? (
                <TicketTableSectionChief
                  tickets={ticketsByType[type]}
                  headerActions={copyButton}
                />
              ) : (
                <TicketTableSection
                  tickets={ticketsByType[type]}
                  isAdmin={isAdmin}
                  headerActions={copyButton}
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </>
  );
}
