import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getMultiTenantLandingConfig } from '@/lib/config/multi-tenant-landing';
import { normalizeRootDomain, ROOT_LANDING_HEADER } from '@/lib/tenancy/host';

export default async function MultiTenantLandingPage() {
  if ((await headers()).get(ROOT_LANDING_HEADER) !== '1') notFound();

  const landing = getMultiTenantLandingConfig();
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');

  return (
    <main className='relative flex min-h-svh items-center justify-center overflow-hidden px-6 py-20 text-slate-50 bg-zinc-950'>
      <div
        aria-hidden='true'
        className='absolute size-64 rounded-full opacity-10 blur-3xl'
        style={{ backgroundColor: landing.color }}
      />
      <div className='relative mx-auto max-w-3xl text-center'>
        <h1 className='text-3xl font-bold tracking-tight sm:text-6xl'>
          {rootDomain}
        </h1>
      </div>
    </main>
  );
}
