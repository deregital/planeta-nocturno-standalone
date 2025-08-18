import { trpc } from '@/server/trpc/server';
import { redirect } from 'next/navigation';
import { CreateEventStoreProvider } from '../../create/provider';
import Client from './client';

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
    <CreateEventStoreProvider>
      <Client />
    </CreateEventStoreProvider>
  );
}
