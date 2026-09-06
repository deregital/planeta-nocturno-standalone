import { redirect } from 'next/navigation';

import LoginClient from '@/app/login/client';
import { auth, clearStaleControlSession } from '@/server/auth';
import { getControlAdminPermissions } from '@/server/control/can-manage-tenants';
import { getControlLandingPath } from '@/server/control/landing-path';

export default async function ControlLoginPage() {
  await clearStaleControlSession();

  const session = await auth();
  if (session?.user.role === 'CONTROL_ADMIN') {
    const permissions = await getControlAdminPermissions();
    const landing = await getControlLandingPath(permissions);
    if (landing !== '/login') redirect(landing);
  }

  return (
    <main className='flex min-h-screen items-center justify-center p-8'>
      <div className='w-full max-w-xl'>
        <p className='mb-2 text-center text-sm font-medium text-accent'>
          Administración central
        </p>
        <LoginClient />
      </div>
    </main>
  );
}
