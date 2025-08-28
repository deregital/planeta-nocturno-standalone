import Link from 'next/link';
import { headers } from 'next/headers';

import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const headersList = await headers();
  const dni = headersList.get('referer')?.split('/').pop();

  return (
    <div className='flex flex-col gap-4 items-center justify-center h-screen'>
      <h1 className='text-3xl font-bold text-center'>
        No se encontró la persona con el dni {dni}
      </h1>
      <Link href='/admin/database'>
        <Button>Volver</Button>
      </Link>
    </div>
  );
}
