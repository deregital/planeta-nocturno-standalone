import { redirect } from 'next/navigation';
import { type Route } from 'next';

import { saveCredentials } from '@/app/credentials/action';
import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { hasMercadoPagoCredentials } from '@/server/services/mercadoPagoCredentials';
import { getDefaultPathByRole } from '@/server/utils/authRedirect';

type CredentialsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  'missing-instance-url':
    'Falta INSTANCE_WEB_URL en el entorno para poder asociar esta instancia. Por favor contacta al administrador.',
  'missing-access-token': 'Debes completar MP_ACCESS_TOKEN.',
  'missing-secret-key': 'Debes completar MP_SECRET_KEY.',
  'save-failed': 'No se pudieron guardar las credenciales. Intenta nuevamente.',
};

export default async function CredentialsPage({
  searchParams,
}: CredentialsPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const hasCredentials = await hasMercadoPagoCredentials();
  if (hasCredentials) {
    redirect(getDefaultPathByRole(session.user.role) as Route);
  }

  const params = searchParams ? await searchParams : undefined;
  const error = params?.error ? errorMessages[params.error] : undefined;

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-10'>
      <section className='rounded-xl border border-stroke/50 bg-white p-6 shadow-sm sm:p-8'>
        <h1 className='text-2xl font-semibold text-main'>
          Configuracion de credenciales de Mercado Pago
        </h1>
        <p className='mt-3 text-sm text-main/80'>
          Esta instancia todavia no tiene configuradas las credenciales de pago.
          Sin <code>MP_ACCESS_TOKEN</code> y <code>MP_SECRET_KEY</code> no se
          pueden procesar pagos.
        </p>
        <p className='mt-2 text-sm text-main/80'>
          Completa los datos y guardalos para habilitar los pagos.
        </p>

        <form action={saveCredentials} className='mt-6 space-y-4'>
          <div className='space-y-1'>
            <label
              htmlFor='accessToken'
              className='text-sm font-medium text-main'
            >
              MP_ACCESS_TOKEN
            </label>
            <input
              id='accessToken'
              name='accessToken'
              type='text'
              className='w-full rounded-md border border-stroke bg-transparent px-3 py-2 text-sm outline-none ring-main/30 focus:ring'
              autoComplete='off'
            />
          </div>

          <div className='space-y-1'>
            <label
              htmlFor='secretKey'
              className='text-sm font-medium text-main'
            >
              MP_SECRET_KEY
            </label>
            <input
              id='secretKey'
              name='secretKey'
              type='text'
              className='w-full rounded-md border border-stroke bg-transparent px-3 py-2 text-sm outline-none ring-main/30 focus:ring'
              autoComplete='off'
            />
          </div>

          {error && (
            <p className='text-sm text-red-600' role='alert'>
              {error}
            </p>
          )}

          <Button type='submit'>Guardar credenciales</Button>
        </form>
      </section>
    </main>
  );
}
