export default async function Page({
  params: { slug },
}: {
  params: { slug: string };
}) {
  // traer pdf segun el paymentId

  return <p>{slug} success</p>;
}
