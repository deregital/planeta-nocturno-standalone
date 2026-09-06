import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getMultiTenantLandingConfig } from '@/lib/config/multi-tenant-landing';
import { ROOT_LANDING_HEADER } from '@/lib/tenancy/host';

export default async function MultiTenantLandingPage() {
  if ((await headers()).get(ROOT_LANDING_HEADER) !== '1') notFound();

  const landing = getMultiTenantLandingConfig();

  return (
    <main className='relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-50 px-6 py-20 text-slate-950'>
      <div
        aria-hidden='true'
        className='absolute size-64 rounded-full opacity-10 blur-3xl'
        style={{ backgroundColor: landing.color }}
      />

      <div className='relative mx-auto max-w-3xl text-center'>
        <div
          aria-hidden='true'
          className='mx-auto mb-8 h-1 w-12 rounded-full'
          style={{ backgroundColor: landing.color }}
        />
        <h1 className='text-5xl font-bold tracking-tight sm:text-7xl'>
          {landing.name}
        </h1>
        <p className='mt-6 text-lg leading-8 text-slate-600 sm:text-xl'>
          {landing.description}
        </p>
      </div>
    </main>
  );
}
