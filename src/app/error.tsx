'use client';
import { useEffect } from 'react';
import posthog from 'posthog-js';

import ErrorCard from '@/components/common/ErrorCard';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Los errores de servidor llegan sin mensaje pero con digest: sirve para
    // cruzarlos con el $exception que manda instrumentation.ts.
    posthog.captureException(error, { error_digest: error.digest });
  }, [error]);

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
