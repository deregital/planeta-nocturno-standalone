'use client';

import { useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { type RouterOutputs } from '@/server/routers/app';

interface OrganizerCardsProps {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
  chiefOrganizerId: string;
  onOrganizerClick: (organizerName: string) => void;
}

export function OrganizerCards({
  event,
  chiefOrganizerId,
  onOrganizerClick,
}: OrganizerCardsProps) {
  const organizers = useMemo(() => {
    const chiefOrganizers = event.eventXorganizers.filter(
      (eo) => eo.user.chiefOrganizerId === chiefOrganizerId,
    );

    if (chiefOrganizers.length === 0) {
      return [];
    }

    const organizerIds = chiefOrganizers.map((eo) => eo.user.id);

    // Count tickets for each organizer
    const ticketCountsByOrganizer = new Map<string, number>();

    event.ticketGroups.forEach((tg) => {
      if (tg.status === 'BOOKED' || !tg.invitedById) {
        return;
      }

      if (!organizerIds.includes(tg.invitedById)) {
        return;
      }

      // Count emitted tickets in this group
      const ticketCount = tg.emittedTickets?.length || 0;
      const currentCount = ticketCountsByOrganizer.get(tg.invitedById) || 0;
      ticketCountsByOrganizer.set(tg.invitedById, currentCount + ticketCount);
    });

    // Map organizers with their counts
    return chiefOrganizers.map((eo) => ({
      id: eo.user.id,
      fullName: eo.user.fullName,
      ticketCount: ticketCountsByOrganizer.get(eo.user.id) || 0,
    }));
  }, [event, chiefOrganizerId]);

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mx-auto px-4'>
      <div className='overflow-x-auto'>
        <div className='flex gap-4 min-w-max'>
          {organizers.map((organizer) => (
            <Card
              key={organizer.id}
              className='min-w-[200px] border-accent cursor-pointer hover:bg-accent-ultra-light transition-all hover:shadow-md'
              onClick={() => onOrganizerClick(organizer.fullName)}
            >
              <CardContent>
                <div className='flex flex-col gap-2'>
                  <h3 className='font-semibold text-lg truncate max-w-[180px]'>
                    {organizer.fullName}
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    {organizer.ticketCount} entradas vendidas
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
