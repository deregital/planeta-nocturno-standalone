'use client';

import { useSession } from 'next-auth/react';

import { trpc } from '@/server/trpc/client';

export function useOrganizerPickerOptions() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const adminQuery = trpc.user.getOrganizers.useQuery(undefined, {
    enabled: status === 'authenticated' && role === 'ADMIN',
  });

  const chiefQuery = trpc.user.getOrganizersByChiefOrganizer.useQuery(
    undefined,
    {
      enabled: status === 'authenticated' && role === 'CHIEF_ORGANIZER',
    },
  );

  if (role === 'CHIEF_ORGANIZER') {
    return {
      data: chiefQuery.data,
      isLoading: chiefQuery.isLoading,
    };
  }

  if (role === 'ADMIN') {
    return {
      data: adminQuery.data,
      isLoading: adminQuery.isLoading,
    };
  }

  return {
    data: undefined,
    isLoading: false,
  };
}
