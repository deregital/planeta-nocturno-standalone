import { type Route } from 'next';
import { redirect } from 'next/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/users/${encodeURIComponent(id)}` as Route);
}
