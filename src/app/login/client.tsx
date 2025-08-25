'use client';

import { useActionState } from 'react';

import { authenticate } from '@/app/login/action';

export default function LoginClient() {
  const [state, action, isPending] = useActionState(authenticate, {});

  return (
    <form action={action}>
      <input type='text' name='name' placeholder='Nombre de usuario' />
      {state.errors?.name && (
        <p className='text-red-500'>{state.errors.name}</p>
      )}
      <input type='password' name='password' placeholder='Password' />
      {state.errors?.password && (
        <p className='text-red-500'>{state.errors.password}</p>
      )}
      {state.errors?.general && (
        <p className='text-red-500'>{state.errors.general}</p>
      )}
      <button disabled={isPending} type='submit'>
        {isPending ? 'Loading...' : 'Login'}
      </button>
    </form>
  );
}
