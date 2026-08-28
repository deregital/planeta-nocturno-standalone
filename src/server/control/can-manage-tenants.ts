import 'server-only';

import { headers } from 'next/headers';

import { auth } from '@/server/auth';
import { isControlRequest } from '@/server/control/is-control-request';

export async function canManageTenants() {
  return Boolean(await getControlAdminSession());
}

export async function getControlAdminSession() {
  const session = await auth();
  if (session?.user.role !== 'CONTROL_ADMIN') return null;
  if (!isControlRequest(new Headers(await headers()))) return null;
  return session;
}
