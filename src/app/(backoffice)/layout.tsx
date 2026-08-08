import { SessionProvider } from 'next-auth/react';
import { redirect } from 'next/navigation';

import SideBar from '@/components/admin/SideBar';
import TopBar from '@/components/admin/TopBar';
import { auth } from '@/server/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect('/login');

  return (
    <SessionProvider>
      <div
        className='grid grid-rows-[auto_1fr] min-h-screen h-full'
        style={
          {
            '--sidebar-width': '12rem',
          } as React.CSSProperties
        }
      >
        <TopBar auth={session} />
        <div className='flex min-w-0'>
          <SideBar role={session.user.role} />
          <main className='min-w-0 flex-1 overflow-x-hidden border-l-3 border-stroke/40'>
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
