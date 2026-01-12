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
import {
  ORGANIZER_TICKET_TYPE_NAME,
  TICKET_TYPE_SLUG_QUERY_PARAM,
} from '@/server/utils/constants';
import { type TicketType } from '@/server/types';

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
        value={tab}
      >
        <TabsList className='flex-1 w-full md:max-w-[98%] max-w-[98%] mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
          {Object.keys(ticketsByType).map((type) => (
            <TabsTrigger className='min-w-2xs px-4' key={type} value={type}>
              {type}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(ticketsByType).map((type) => {
          const currentTicketType = ticketTypes.find((tt) => tt.name === type);
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
