'use client';

import { Scanner } from '@yudiel/react-qr-scanner';

export function QRCodeScanner({
  onScanSuccessAction,
  isLoading,
}: {
  onScanSuccessAction: (result: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className='bg-accent-dark transition-opacity'>
      <Scanner
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
        scanDelay={1000}
        formats={['qr_code']}
        onScan={(result) =>
          !isLoading ? onScanSuccessAction(result[0].rawValue) : undefined
        }
      />
    </div>
  );
}
