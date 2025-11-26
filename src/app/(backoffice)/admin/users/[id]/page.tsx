import { notFound } from 'next/navigation';
import z from 'zod';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import Client from '@/app/(backoffice)/admin/users/[id]/client';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const validatedId = z.uuid().safeParse(id);

  if (!validatedId.success) {
    return notFound();
  }

  return (
    <NuqsAdapter>
      <Client organizerId={validatedId.data} />
    </NuqsAdapter>
  );
}
