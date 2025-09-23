'use client';
import ErrorCard from '@/components/common/ErrorCard';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <ErrorCard
          title='Algo salió mal'
          description='Hubo un error al realizar la acción. Intentá nuevamente.'
          route='/'
          disabledLink={true}
        />
      </body>
    </html>
  );
}
