'use client';

import { useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import {
  buildAdminOrganizerCards,
  buildChiefTeamOrganizerCards,
  type OrganizerCardClickPayload,
} from '@/lib/organizer-cards';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

interface OrganizerCardsProps {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
  onOrganizerClick?: (payload: OrganizerCardClickPayload) => void;
  chiefOrganizerId?: string;
}

export function OrganizerCards({
  event,
  onOrganizerClick,
  chiefOrganizerId,
}: OrganizerCardsProps) {
  const organizers = useMemo(() => {
    if (chiefOrganizerId) {
      return buildChiefTeamOrganizerCards(event, chiefOrganizerId);
    }
    return buildAdminOrganizerCards(event);
  }, [event, chiefOrganizerId]);

  if (organizers.length === 0) {
    return null;
  }

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mx-auto px-4'>
      <div className='overflow-x-auto'>
        <div className='flex gap-4 min-w-max pb-2'>
          {organizers.map((organizer) => (
            <Card
              key={organizer.id}
              className={cn(
                'min-w-[220px] transition-all hover:shadow-md',
                onOrganizerClick &&
                  'cursor-pointer hover:bg-accent-ultra-light',
                organizer.emittedCount > 0
                  ? 'border-green-500'
                  : 'border-red-500',
              )}
              onClick={
                onOrganizerClick
                  ? () =>
                      onOrganizerClick({
                        searchLabel: organizer.fullName,
                        invitedByIds: organizer.filterInvitedByIds,
                      })
                  : undefined
              }
            >
              <CardContent>
                <div className='flex flex-col gap-2'>
                  <h3 className='font-semibold text-lg truncate max-w-[200px]'>
                    {organizer.isChief && (
                      <span className='mr-1' aria-hidden>
                        👤
                      </span>
                    )}
                    {organizer.fullName}
                  </h3>
                  <p className='text-sm text-muted-foreground tabular-nums'>
                    {organizer.emittedCount} de {organizer.maxEmitible} (
                    {organizer.emissionPercent.toFixed(1)}%) tickets emitidos
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
