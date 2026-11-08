'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { ScannerScreen } from '@/components/event/individual/scan/ScannerScreen';

export default function ScanMultiClient({ eventIds }: { eventIds: string[] }) {
  return (
    <ScannerScreen
      eventIds={eventIds}
      topLeft={
        <Link
          href='/admin/ticketing'
          className='flex items-center gap-1 text-white bg-accent/25 hover:bg-accent/40 transition-colors rounded-md px-3 py-2 text-sm font-medium'
        >
          <ArrowLeft className='size-4' />
          Cambiar eventos
        </Link>
      }
    />
  );
}
