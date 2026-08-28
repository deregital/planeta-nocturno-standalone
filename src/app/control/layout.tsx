import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { isControlRequest } from '@/server/control/is-control-request';

export default async function ControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isControlRequest(new Headers(await headers()))) notFound();
  return children;
}
