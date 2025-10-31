import { useMemo } from 'react';

import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';

export function calculateMaxTicketsPerOrganizer(
  capacity: number,
  totalOrganizers: number,
) {
  if (totalOrganizers === 0) return capacity;

  const availableCapacity = capacity - totalOrganizers;
  const maxPerOrganizer = Math.floor(availableCapacity / totalOrganizers);

  return Math.max(0, maxPerOrganizer);
}

export function useOrganizerTickets(type: InviteCondition) {
  const organizers = useCreateEventStore((state) => state.organizers);
  const { locationId } = useCreateEventStore((state) => state.event);
  const { data: location } = trpc.location.getById.useQuery(locationId, {
    enabled: !!locationId,
  });

  const maxNumber = useMemo(() => {
    if (type === 'TRADITIONAL') {
      return 100;
    }

    if (!location?.capacity) return 0;

    const totalOrganizers = organizers.length;
    return calculateMaxTicketsPerOrganizer(location.capacity, totalOrganizers);
  }, [type, location?.capacity, organizers.length]);

  return {
    maxNumber,
    maxCapacity: location?.capacity,
  };
}
