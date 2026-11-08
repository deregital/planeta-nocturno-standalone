'use client';

import { History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { type ScanEntry } from '@/components/event/individual/scan/useScanSession';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerHeader,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';

export function LastScansHistory({ lastScans }: { lastScans: ScanEntry[] }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='ghost' className='bg-accent/25'>
          <History className='size-6 text-white' />
        </Button>
      </DrawerTrigger>
      <DrawerContent className='px-4'>
        <DrawerHeader>
          <DrawerTitle>Historial de escaneos</DrawerTitle>
        </DrawerHeader>
        <div className='flex flex-col gap-4 min-h-[500px] max-h-[80vh] overflow-y-auto'>
          {lastScans.map((scan, idx) => (
            <LastScanCard key={idx} lastScan={scan} />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
