import { redirect } from 'next/navigation';

import LoginClient from '@/app/login/client';
import { auth } from '@/server/auth';

export default async function ControlLoginPage() {
  const session = await auth();
  if (session?.user.role === 'CONTROL_ADMIN') redirect('/');

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
