import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import LoginClient from './client';

export default async function Login() {
  const session = await auth();
  if (session) redirect('/admin');
  return (
    <div className='h-full flex items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]'>
      <LoginClient />
    </div>
  );
}
