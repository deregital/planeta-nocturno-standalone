import { LogOut } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { auth, signOut } from '@/server/auth';

export default async function ProtectedControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== 'CONTROL_ADMIN') redirect('/login');

  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='flex h-16 items-center justify-between bg-accent-dark px-6 text-white'>
        <div>
          <p className='font-bold'>Panel central</p>
          <p className='text-xs text-brand'>Gestión de instancias</p>
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
