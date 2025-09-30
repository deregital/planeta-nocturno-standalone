'use client';

import { Scanner } from '@yudiel/react-qr-scanner';

export function QRCodeScanner({
  onScanSuccess,
  onScanError,
}: {
  onScanSuccess: (result: string) => void;
  onScanError: (error: string) => void;
}) {
  return (
    <Scanner
      classNames={{
        container: 'w-full h-fit my-auto',
        video: 'w-full h-fit my-auto',
      }}
      scanDelay={100}
      formats={['qr_code']}
      onScan={(result) => onScanSuccess(result[0].rawValue)}
    />
  );
}
