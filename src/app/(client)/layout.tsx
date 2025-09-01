import TopBar from '@/components/admin/TopBar';
import { auth } from '@/server/auth';

export default async function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <div className='grid grid-rows-[auto_1fr] h-screen'>
      <TopBar auth={session} />
      {children}
    </div>
  );
}
