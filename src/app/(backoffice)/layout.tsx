import { SessionProvider } from 'next-auth/react';
import { redirect } from 'next/navigation';

import SideBar from '@/components/admin/SideBar';
import TopBar from '@/components/admin/TopBar';
import { auth } from '@/server/auth';
import { hasMercadoPagoCredentials } from '@/server/services/mercadoPagoCredentials';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect('/login');
  const hasCredentials = await hasMercadoPagoCredentials();
  if (!hasCredentials && session.user.role === 'ADMIN')
    redirect('/credentials');

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
        <div className='flex'>
          <SideBar role={session.user.role} />
          <main className='flex-1 border-l-3 border-stroke/40 '>
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
