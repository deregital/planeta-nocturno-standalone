import { redirect } from 'next/navigation';

import CredentialsRedeployStatus from '@/app/credentials/wait/status-client';
import { auth } from '@/server/auth';

type WaitPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function CredentialsWaitPage({
  searchParams,
}: WaitPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const params = searchParams ? await searchParams : undefined;
  const nextPath = params?.next || '/admin';

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-10'>
      <section className='rounded-xl border border-stroke/50 bg-white p-6 shadow-sm sm:p-8'>
        <h1 className='text-2xl font-semibold tracking-tight text-main'>
          Terminando de conectar Mercado Pago
        </h1>
        <p className='mt-2 text-sm leading-relaxed text-main/80'>
          Al aplicarse la configuración, esta pantalla se actualizará
          automáticamente y te llevará al inicio. Esto suele tardar unos
          minutos.
        </p>
        <CredentialsRedeployStatus nextPath={nextPath} />
      </section>
    </main>
  );
}
