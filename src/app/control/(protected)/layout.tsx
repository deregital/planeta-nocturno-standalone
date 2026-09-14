import { redirect } from 'next/navigation';

import ControlHeader from '@/components/control/ControlHeader';
import { auth, clearStaleControlSession, signOut } from '@/server/auth';
import { getControlAdminPermissions } from '@/server/control/can-manage-tenants';
import { getControlLandingPath } from '@/server/control/landing-path';

export default async function ProtectedControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== 'CONTROL_ADMIN') {
    await clearStaleControlSession();
    redirect('/login');
  }

  const permissions = (await getControlAdminPermissions()) ?? [];
  const canReadTenants =
    permissions.includes('tenants:read') ||
    permissions.includes('tenants:read_all');
  const canReadAdmins = permissions.includes('admins:read');
  const canReadRoles = permissions.includes('roles:read');

  if (!canReadTenants && !canReadAdmins && !canReadRoles) {
    await signOut({ redirectTo: '/login' });
  }

  const homeHref = await getControlLandingPath(permissions);

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <ControlHeader
        homeHref={homeHref}
        userName={session.user.name}
        canReadTenants={canReadTenants}
        canReadAdmins={canReadAdmins}
        canReadRoles={canReadRoles}
        signOutAction={signOutAction}
      />
      <main className='mx-auto w-full max-w-7xl p-6'>{children}</main>
    </div>
  );
}
