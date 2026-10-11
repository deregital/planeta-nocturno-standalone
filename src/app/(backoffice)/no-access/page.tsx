import { ShieldOff } from 'lucide-react';

import { SignOutButton } from '@/app/(backoffice)/no-access/sign-out-button';

export default function NoAccessPage() {
  return (
    <div className='flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[60vh]'>
      <ShieldOff className='size-12 text-accent' />
      <h1 className='text-2xl font-bold text-accent'>Sin acceso</h1>
      <p className='max-w-md text-accent/80'>
        Tu rol no tiene permisos para ninguna sección de la plataforma. Pedile a
        un administrador que te asigne los permisos necesarios.
      </p>
      <SignOutButton />
    </div>
  );
}
