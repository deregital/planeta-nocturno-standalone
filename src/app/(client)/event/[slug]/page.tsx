import { notFound } from 'next/navigation';

import Client from '@/app/(client)/event/[slug]/client';
import { trpc } from '@/server/trpc/server';

interface EventPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    notFound();
  }

  return <Client event={event} />;
}

export default EventPage;
