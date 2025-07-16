import { signIn } from '@/server/auth';

export default function Login() {
  return (
    <div className='h-full flex items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]'>
      <form
        action={async () => {
          'use server';
          await signIn('credentials', { redirectTo: '/admin' });
        }}
        method='post'
      >
        <input type='email' name='email' placeholder='Email' />
        <input type='password' name='password' placeholder='Password' />
        <button type='submit'>Login</button>
      </form>
    </div>
  );
}
