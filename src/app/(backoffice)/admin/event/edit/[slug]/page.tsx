import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Loader } from 'lucide-react';

import { trpc } from '@/server/trpc/server';
import { CreateEventStoreProvider } from '@/app/(backoffice)/admin/event/create/provider';
import Client from '@/app/(backoffice)/admin/event/edit/[slug]/client';

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
