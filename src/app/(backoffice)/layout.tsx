import { SessionProvider } from 'next-auth/react';
import { redirect } from 'next/navigation';

import SideBar from '@/components/admin/SideBar';
import TopBar from '@/components/admin/TopBar';
import { PermissionsProvider } from '@/components/rbac/PermissionsProvider';
import { auth } from '@/server/auth';
import { getCurrentAccess } from '@/server/rbac/guards';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect('/login');
  if (session.user.role === 'CONTROL_ADMIN') redirect('/');

  const access = await getCurrentAccess();

  return (
    <SessionProvider>
      <PermissionsProvider
        roleName={access?.accessRole?.name ?? null}
        permissions={access?.permissions ?? []}
      >
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
            <SideBar />
            <main className='min-w-0 flex-1 overflow-x-hidden border-l-3 border-stroke/40'>
              {children}
            </main>
          </div>
          {/* <Suspense fallback={<HelpDrawer videos={[]} />}>
          <TenantHelpDrawer userRole={session.user.role} />
        </Suspense> */}
        </div>
      </PermissionsProvider>
    </SessionProvider>
  );
}

/*
async function TenantHelpDrawer({ userRole }: { userRole: string }) {
  const videos = await getGuideVideos(userRole);
  return <HelpDrawer videos={videos} />;
}
*/
