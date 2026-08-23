import { Ticket } from 'lucide-react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getMultiTenantLandingConfig } from '@/lib/config/multi-tenant-landing';
import { ROOT_LANDING_HEADER } from '@/lib/tenancy/host';

export default async function MultiTenantLandingPage() {
  if ((await headers()).get(ROOT_LANDING_HEADER) !== '1') notFound();

  const landing = getMultiTenantLandingConfig();

  return (
    <main className='relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-6 py-16 text-slate-950'>
      <div
        className='absolute -top-32 -right-32 size-80 rounded-full opacity-10 blur-3xl'
        style={{ backgroundColor: landing.color }}
      />
      <div
        className='absolute -bottom-40 -left-32 size-96 rounded-full opacity-10 blur-3xl'
        style={{ backgroundColor: landing.color }}
      />

      <section className='relative mx-auto flex max-w-3xl flex-col items-center text-center'>
        <div
          className='mb-8 flex size-16 items-center justify-center rounded-2xl text-white shadow-lg'
          style={{ backgroundColor: landing.color }}
        >
          <Ticket aria-hidden='true' className='size-8' />
        </div>

        <h1 className='text-5xl font-bold tracking-tight sm:text-7xl'>
          {landing.name}
        </h1>
        <p className='mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl'>
          {landing.description}
        </p>

        <div
          className='mt-10 h-1 w-20 rounded-full'
          style={{ backgroundColor: landing.color }}
        />
      </section>
    </main>
  );
}
