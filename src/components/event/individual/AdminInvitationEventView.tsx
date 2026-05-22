'use client';

import { useState } from 'react';

import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { OrganizerCards } from '@/components/organization/event/OrganizerCards';
import { type RouterOutputs } from '@/server/routers/app';

export function AdminInvitationEventView({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined);
  const [filterInvitedByIds, setFilterInvitedByIds] = useState<
    string[] | undefined
  >(undefined);

  return (
    <div className='w-full'>
      <OrganizerCards
        event={event}
        onOrganizerClick={({ searchLabel, invitedByIds }) => {
          setSearchValue(searchLabel);
          setFilterInvitedByIds(invitedByIds);
        }}
      />
      <TicketTableWithTabs
        ticketTypes={event.ticketTypes}
        externalSearchValue={searchValue}
        externalFilterInvitedByIds={filterInvitedByIds}
        onClearOrganizerFilter={() => setFilterInvitedByIds(undefined)}
        event={{
          slug: event.slug,
          inviteCondition: event.inviteCondition,
          hasSimpleInvitation: event.hasSimpleInvitation,
        }}
      />
    </div>
  );
}
