import { trpc } from '@/server/trpc/server';
import { redirect } from 'next/navigation';
import { CreateEventStoreProvider } from '../../create/provider';
import Client from './client';
import { Suspense } from 'react';
import { Loader } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    redirect('/admin/event');
  }

  return (
    <Suspense fallback={<Loader className='animate-spin' />}>
      <CreateEventStoreProvider>
        <Client event={event} />
      </CreateEventStoreProvider>
    </Suspense>
  );
}
