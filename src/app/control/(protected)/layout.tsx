import { Building2, LogOut, Shield, Users } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
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

  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='flex h-16 items-center justify-between gap-4 bg-accent-dark px-6 text-white'>
        <div className='flex items-center gap-6'>
          <Link href={homeHref} className='hover:opacity-90'>
            <p className='font-bold'>Panel central</p>
            <p className='text-xs text-brand'>Administración general</p>
          </Link>
          <nav className='hidden items-center gap-1 sm:flex'>
            {canReadTenants && (
              <NavLink
                href={'/' as Route}
                icon={<Building2 className='size-4' />}
              >
                Plataformas
              </NavLink>
            )}
            {canReadAdmins && (
              <NavLink
                href={'/users' as Route}
                icon={<Users className='size-4' />}
              >
                Usuarios
              </NavLink>
            )}
            {canReadRoles && (
              <NavLink
                href={'/roles' as Route}
                icon={<Shield className='size-4' />}
              >
                Roles
              </NavLink>
            )}
          </nav>
        </div>
        <div className='flex items-center gap-4'>
          <span className='hidden text-sm text-brand sm:block'>
            {session.user.name}
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type='submit' variant='accent' size='sm'>
              <LogOut />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className='mx-auto w-full max-w-7xl p-6'>{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: Route;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className='inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-brand hover:bg-white/10 hover:text-white'
    >
      {icon}
      {children}
    </Link>
  );
}
