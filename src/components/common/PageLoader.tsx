import { Loader2 } from 'lucide-react';

/** Fallback de los `loading.tsx`: se muestra apenas se navega, mientras el servidor renderiza la página. */
export function PageLoader() {
  return (
    <div
      role='status'
      aria-label='Cargando'
      className='flex min-h-[50vh] w-full items-center justify-center'
    >
      <Loader2 className='size-8 animate-spin text-accent' />
    </div>
  );
}
