'use client';
import ErrorCard from '@/components/common/ErrorCard';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorCard
      title='Algo salió mal'
      description='Hubo un error al realizar la acción. Intentá nuevamente.'
      route='/'
    >
      <Button onClick={() => reset()}>Intentar nuevamente</Button>
    </ErrorCard>
  );
}
