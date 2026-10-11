import { type Route } from 'next';
import { redirect } from 'next/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ dni: string }>;
}) {
  const { dni } = await params;
  redirect(`/admin/database/${encodeURIComponent(dni)}` as Route);
}
