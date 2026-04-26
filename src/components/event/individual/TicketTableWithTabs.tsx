'use client';

import { Link } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SearchTickets } from '@/components/event/individual/SearchTickets';
import { TicketTableSection } from '@/components/event/individual/ticketsTable/TicketTableSection';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/server/trpc/client';
import {
  type InviteCondition,
  type Role,
  type TicketType,
} from '@/server/types';
import {
  ORGANIZER_CODE_QUERY_PARAM,
  ORGANIZER_TICKET_TYPE_NAME,
  TICKET_TYPE_SLUG_QUERY_PARAM,
} from '@/server/utils/constants';

export function TicketTableWithTabs({
  ticketTypes,
  externalSearchValue,
  userId,
  event,
}: {
  ticketTypes: TicketType[];
  externalSearchValue?: string;
  userId?: string;
  event: {
    slug: string;
    inviteCondition: InviteCondition;
    hasSimpleInvitation: boolean;
  };
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

  const { data: myCode } = trpc.organizer.getMyCode.useQuery(undefined, {
    enabled:
      session.data?.user.role === 'ORGANIZER' ||
      session.data?.user.role === 'CHIEF_ORGANIZER',
  });
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

  const tabItems = useMemo(() => {
    if (!filteredTickets) return [];
    return sortedTicketTypes.map((type) => {
      const ticketsByType = filteredTickets.filter(
        (ticket) => ticket.ticketType.id === type.id,
      );
      const tabValue = type.slug || type.id;

      return {
        tabValue,
        id: type.id,
        name: type.name,
        slug: type.slug,
        tickets: [...ticketsByType],
      };
    });
  }, [filteredTickets, sortedTicketTypes]);

  const initialTab = useMemo(
    () => sortedTicketTypes[0]?.slug || sortedTicketTypes[0]?.id || '',
    [sortedTicketTypes],
  );

  const [tab, setTab] = useState(() => initialTab);

  // Ensure tab is always valid - use the current tab if it exists, otherwise use the first tab
  const currentTab = useMemo(() => {
    const availableTabs = tabItems.map((item) => item.tabValue);
    return availableTabs.includes(tab) ? tab : availableTabs[0] || '';
  }, [tab, tabItems]);

  const copyTicketTypeUrl = (ticketTypeSlug: string) => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';
    const url = `${origin}/event/${event.slug}?${myCode ? `${ORGANIZER_CODE_QUERY_PARAM}=${myCode}&` : ''}${TICKET_TYPE_SLUG_QUERY_PARAM}=${ticketTypeSlug}`;
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
          {tabItems.map((item) => (
            <TabsTrigger
              className='md:min-w-2xs max-w-xs px-4'
              key={item.tabValue}
              value={item.tabValue}
            >
              <span className='truncate' title={item.name}>
                <span className='md:hidden'>
                  {item.name.length > 16
                    ? `${item.name.slice(0, 16)}…`
                    : item.name}
                </span>
                <span className='hidden md:inline'>{item.name}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabItems.map((item) => {
          const isOrganizerTicket =
            item.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim();
          const copyButton =
            item.slug &&
            !isOrganizerTicket &&
            event.inviteCondition !== 'INVITATION' ? (
              <Button
                variant='ghost'
                className='w-fit'
                onClick={() => copyTicketTypeUrl(item.slug)}
              >
                <Link className='w-4 h-4 mr-2' />
                Copiar tipo de ticket
              </Button>
            ) : null;

          return (
            <TabsContent key={item.tabValue} value={item.tabValue}>
              {session.data?.user.role === 'CHIEF_ORGANIZER' ? (
                <TicketTableSection
                  tickets={item.tickets}
                  role={session.data?.user.role}
                  headerActions={copyButton}
                  event={{
                    inviteCondition: event.inviteCondition,
                    hasSimpleInvitation: event.hasSimpleInvitation,
                  }}
                />
              ) : (
                <TicketTableSection
                  tickets={item.tickets}
                  role={session.data?.user.role as Role}
                  headerActions={copyButton}
                  event={event}
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </>
  );
}
