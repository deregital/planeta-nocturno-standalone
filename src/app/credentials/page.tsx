import { type Route } from 'next';
import { redirect } from 'next/navigation';

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
    'Ocurrió un error en el servidor. Por favor contacta al administrador. (ERROR: missing-instance-url)',
  'invalid-access-token':
    'El Access Token no tiene un formato válido. Asegurate de copiarlo correctamente.',
  'invalid-secret-key':
    'La Clave Secreta no tiene un formato válido. Asegurate de copiarla correctamente.',
  'missing-access-token':
    'No completaste el Access Token. Copialo desde Mercado Pago y pegalo en el campo correspondiente.',
  'missing-secret-key':
    'No completaste la Clave Secreta. Copiala desde Mercado Pago y pegala en el campo correspondiente.',
  'save-failed':
    'No pudimos guardar los datos. Revisá que estén bien copiados e intentá de nuevo.',
  'missing-env-variable':
    'Ocurrió un error en el servidor. Por favor contacta al administrador. (ERROR: missing-env-variable)',
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
        <h1 className='text-2xl font-semibold tracking-tight text-main'>
          Configuración de credenciales de Mercado Pago
        </h1>

        <form action={saveCredentials} className='mt-6 space-y-4'>
          <div className='space-y-2'>
            <label
              htmlFor='accessToken'
              className='text-sm font-medium text-main'
            >
              Access Token
            </label>
            <p className='text-xs text-main/60' id='accessToken-hint'>
              En Producción &gt; Credenciales de producción
            </p>
            <input
              id='accessToken'
              name='accessToken'
              type='text'
              className='w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm outline-none ring-main/30 focus:ring'
              autoComplete='off'
              placeholder='Pegá acá el token de acceso'
              aria-describedby='accessToken-hint'
            />
          </div>

          <div className='space-y-2'>
            <label
              htmlFor='secretKey'
              className='text-sm font-medium text-main'
            >
              Clave Secreta
            </label>
            <p className='text-xs text-main/60' id='secretKey-hint'>
              En Notificaciones &gt; Webhoooks &gt; Modo Productivo
            </p>
            <input
              id='secretKey'
              name='secretKey'
              type='text'
              autoComplete='off'
              className='w-full rounded-md border border-stroke bg-transparent px-3 py-2.5 text-sm outline-none ring-main/30 focus:ring'
              placeholder='Pegá acá la clave secreta'
              aria-describedby='secretKey-hint'
            />
          </div>

          {error && (
            <p
              className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
              role='alert'
            >
              {error}
            </p>
          )}

          <div className='flex flex-col gap-2 pt-1 sm:flex-row sm:items-center'>
            <p className='text-xs text-main/60 sm:pl-2'>
              Después de guardar, la plataforma puede tardar unos minutos en
              aplicar los cambios.
            </p>
            <Button type='submit' className='w-full sm:w-auto'>
              Guardar y continuar
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
