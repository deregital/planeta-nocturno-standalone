'use client';

import CreateLocationModal from '@/components/location/CreateLocationModal';
import { trpc } from '@/server/trpc/client';
import { Loader2 } from 'lucide-react';

export default function Locations() {
  const { data, isLoading } = trpc.location.getAll.useQuery();

  return isLoading ? (
    <Loader2 />
  ) : (
    <div className='px-8'>
      <h1 className='text-3xl font-bold'>Locaciones</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <CreateLocationModal />
    </div>
  );
}
