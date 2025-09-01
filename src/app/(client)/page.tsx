import { NuqsAdapter } from 'nuqs/adapters/next/app';

import GridEvents from '@/components/events/buyPage/GridEvents';
import { EventFilter } from '@/components/events/buyPage/EventFilter';

export default async function Home() {
  return (
    <div className='h-main-screen mx-auto w-full max-w-screen-2xl p-4 font-[family-name:var(--font-geist-sans)]'>
      <NuqsAdapter>
        <EventFilter />
        <GridEvents />
      </NuqsAdapter>
    </div>
  );
}
