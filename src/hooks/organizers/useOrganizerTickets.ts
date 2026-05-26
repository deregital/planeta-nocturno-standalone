import { useMemo } from 'react';

import { type OrganizerSchema } from '@/server/schemas/organizer';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';

export function calculateMaxTicketsPerOrganizer(
  capacity: number,
  totalOrganizers: number,
) {
  if (totalOrganizers === 0) return capacity;

  const availableCapacity = capacity - totalOrganizers;
  const maxPerOrganizer = Math.floor(availableCapacity / totalOrganizers);

  return Math.max(0, maxPerOrganizer);
}

export function calculateMaxTicketsPerOrganizerFromPool(
  pool: number,
  teamCount: number,
  minNumber = 1,
) {
  if (teamCount <= 0) return Math.max(minNumber, pool);
  return Math.max(minNumber, Math.floor(pool / teamCount));
}

export function useOrganizerTickets(
  type: InviteCondition,
  {
    organizers,
    locationId,
    ticketPool,
  }: {
    organizers: OrganizerSchema[];
    locationId: string | null | undefined;
    ticketPool?: number;
  },
) {
  const { data: location } = trpc.location.getById.useQuery(locationId ?? '', {
    enabled: !!locationId && ticketPool === undefined,
  });

  const minNumber = useMemo(() => {
    if (type === 'INVITATION') return 1;
    else return 0;
  }, [type]);

  const maxNumber = useMemo(() => {
    if (type === 'TRADITIONAL') {
      return 100;
    }

    if (ticketPool !== undefined) {
      return calculateMaxTicketsPerOrganizerFromPool(
        ticketPool,
        organizers.length,
        minNumber,
      );
    }

    if (!location?.capacity) return 0;

    const totalOrganizers = organizers.length;
    return calculateMaxTicketsPerOrganizer(location.capacity, totalOrganizers);
  }, [type, location?.capacity, organizers.length, ticketPool, minNumber]);

  return {
    minNumber,
    maxNumber,
    maxCapacity: ticketPool ?? location?.capacity,
    usesTicketPool: ticketPool !== undefined,
  };
}
