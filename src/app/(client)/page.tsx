import { eq } from 'drizzle-orm';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';

import { EventFilter } from '@/components/events/buyPage/EventFilter';
import GridEvents from '@/components/events/buyPage/GridEvents';
import TicketeraHomeSkeleton from '@/components/events/buyPage/TicketeraHomeSkeleton';
import { InstanceLanding } from '@/components/instance/InstanceLanding';
import { feature as featureSchema } from '@/drizzle/schema';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { trpc } from '@/server/trpc/server';

export default async function Home() {
  const { db, instance } = await getCurrentRequestContext();
  const ticketera = await db.query.feature.findFirst({
    where: eq(featureSchema.key, FEATURE_KEYS.TICKETERA),
    columns: { enabled: true },
  });

  if (!(ticketera?.enabled ?? true)) {
    return (
      <InstanceLanding
        name={instance.name}
        description={instance.description}
      />
    );
  }

  return (
    <div className='h-main-screen mx-auto w-full min-w-0 max-w-screen-2xl p-4 font-(family-name:--font-geist-sans)'>
      <Suspense fallback={<TicketeraHomeSkeleton />}>
        <TicketeraHome />
      </Suspense>
    </div>
  );
}

async function TicketeraHome() {
  const [events, categories] = await Promise.all([
    trpc.events.getActive(),
    trpc.eventCategory.getActive(),
  ]);

  return (
    <NuqsAdapter>
      <EventFilter categories={categories} />
      <GridEvents events={events} />
    </NuqsAdapter>
  );
}
