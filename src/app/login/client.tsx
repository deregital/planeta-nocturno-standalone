'use client';

import { useActionState } from 'react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { authenticate } from '@/app/login/action';

function LoginPage() {
  const [state, handleLogin, isPending] = useActionState(authenticate, {});

  return (
    <div className='flex flex-col w-full max-w-5xl items-center'>
      <legend className='mb-4 text-center'>
        <h1 className='text-3xl font-bold text-slate-900'>Iniciar Sesión</h1>
      </legend>
      <fieldset className='w-full max-w-[calc(100%-16px)] rounded-md border-2 border-slate-500/50 p-7 pb-4 lg:max-w-xl'>
        <form action={handleLogin} className='flex flex-col gap-4'>
          <div>
            <Input
              className='bg-white'
              type='text'
              name='username'
              id='username'
              autoComplete='username'
              defaultValue={state.username}
              placeholder='Nombre de usuario'
            />
            {state.errors?.username && (
              <p className='mt-2 text-sm font-bold text-red-500'>
                {state.errors.username}
              </p>
            )}
          </div>
          <div>
            <Input
              className='bg-white'
              type='password'
              name='password'
              id='password'
              autoComplete='current-password'
              defaultValue={state.password}
              placeholder='Contraseña'
            />
            {state.errors?.password && (
              <p className='mt-2 text-sm font-bold text-red-500'>
                {state.errors.password}
              </p>
            )}
          </div>
          <Button disabled={isPending} type='submit'>
            {isPending ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>
        </form>
        {state.errors?.general && (
          <p className='mt-2 text-sm font-bold text-red-500'>
            {state.errors.general}
          </p>
        )}
      </fieldset>
    </div>
  );
}

export default LoginPage;
