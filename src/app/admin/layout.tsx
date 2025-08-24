import SideBar from '@/components/admin/SideBar';
import TopBar from '@/components/admin/TopBar';
import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect('/login');

  return (
    <div className='grid grid-rows-[auto_1fr] h-screen'>
      <TopBar userName={session.user.name} />
      <div className='flex'>
        <SideBar />
        <main className='flex-1'>{children}</main>
      </div>
    </div>
  );
}
