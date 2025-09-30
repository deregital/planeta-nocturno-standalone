'use client';

import { useState } from 'react';

import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export default function ScanClient({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const scanMutation = trpc.emittedTickets.scan.useMutation();
  const [results, setResults] = useState<
    RouterOutputs['emittedTickets']['scan'][]
  >([]);

  return (
    <div>
      <QRCodeScanner
        onScanSuccess={async (raw) => {
          const result = await scanMutation.mutateAsync({
            eventId: event.id,
            barcode: raw,
          });

          setResults((prev) => [...prev, result]);
        }}
        onScanError={() => {}}
      />
      <div className='w-screen'>
        {results.map((result, idx) =>
          result.success ? (
            <div className='bg-green-500' key={idx}>
              <p>{result.text}</p>
              <p>{result.extraInfo}</p>
            </div>
          ) : (
            <div className='bg-red-500' key={idx}>
              <p>{result.text}</p>
              <p>{result.extraInfo}</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
