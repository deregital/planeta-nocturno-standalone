'use client';

import { usePermissions } from '@/components/rbac/PermissionsProvider';
import { trpc } from '@/server/trpc/client';

export function useOrganizerPickerOptions() {
  const { can } = usePermissions();
  const canReadAll = can('organizers:read_all');
  const canReadTeam = !canReadAll && can('organizers:read');

  const allQuery = trpc.user.getOrganizers.useQuery(undefined, {
    enabled: canReadAll,
  });

  const teamQuery = trpc.user.getOrganizersByChiefOrganizer.useQuery(
    undefined,
    {
      enabled: canReadTeam,
    },
  );

  if (canReadAll) {
    return {
      data: allQuery.data,
      isLoading: allQuery.isLoading,
    };
  }

  if (canReadTeam) {
    return {
      data: teamQuery.data,
      isLoading: teamQuery.isLoading,
    };
  }

  return {
    data: undefined,
    isLoading: false,
  };
}
