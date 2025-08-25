export default async function Page({
  params,
}: {
  params: Promise<{ dni: string }>;
}) {
  const { dni } = await params;
  return <div>{dni}</div>;
}
