'use client';

import { useState } from 'react';

import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { OrganizerCards } from '@/components/organization/event/OrganizerCards';
import { type RouterOutputs } from '@/server/routers/app';

interface ChiefOrganizerEventViewProps {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
  chiefOrganizerId: string;
}

export function ChiefOrganizerEventView({
  event,
  chiefOrganizerId,
}: ChiefOrganizerEventViewProps) {
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined);

  return (
    <>
      <OrganizerCards
        event={event}
        chiefOrganizerId={chiefOrganizerId}
        onOrganizerClick={(organizerName: string) => {
          setSearchValue(organizerName);
        }}
      />
      <TicketTableWithTabs
        ticketTypes={event.ticketTypes}
        externalSearchValue={searchValue}
        userId={chiefOrganizerId}
        eventSlug={event.slug}
      />
    </>
  );
}
