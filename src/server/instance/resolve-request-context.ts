import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { getInstanceDb } from '@/server/instance/get-instance-db';
import { resolveInstance } from '@/server/instance/resolve-instance';

export async function resolveRequestContext(requestHeaders: Headers) {
  const instance = await resolveInstance(requestHeaders);
  const db = await getInstanceDb(instance.database);

  return { instance, db };
}

export const getCurrentRequestContext = cache(async () => {
  return resolveRequestContext(new Headers(await headers()));
});
