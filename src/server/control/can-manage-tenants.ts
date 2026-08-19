import 'server-only';

import { headers } from 'next/headers';

import { auth } from '@/server/auth';
import { isControlRequest } from '@/server/control/is-control-request';

export async function canManageTenants() {
  const session = await auth();
  if (session?.user.role !== 'CONTROL_ADMIN') return false;
  return isControlRequest(new Headers(await headers()));
}
