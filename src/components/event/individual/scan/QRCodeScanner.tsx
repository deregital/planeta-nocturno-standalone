'use client';

import { Scanner } from '@yudiel/react-qr-scanner';

export function QRCodeScanner({
  onScanSuccess,
  isLoading,
}: {
  onScanSuccess: (result: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className='bg-accent-dark transition-opacity'>
      <Scanner
        // paused={isLoading}
        classNames={{
          container: 'w-full h-fit my-auto',
          video: 'w-full h-fit my-auto',
        }}
        styles={{
          video: {
            transition: 'opacity 0.2s ease-in-out',
            opacity: isLoading ? 0.2 : 1,
          },
        }}
        scanDelay={100}
        formats={['qr_code']}
        onScan={(result) => onScanSuccess(result[0].rawValue)}
      />
    </div>
  );
}
