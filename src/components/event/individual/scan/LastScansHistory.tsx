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
      {/* Alto fijo del panel y la lista ocupa lo que sobra: con min-h-[500px]
          adentro de un panel de 80vh, en pantallas bajas el final de la lista
          quedaba debajo del borde. */}
      <DrawerContent className='h-[80dvh] px-4'>
        <DrawerHeader>
          <DrawerTitle>Historial de escaneos</DrawerTitle>
        </DrawerHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4'>
          {lastScans.map((scan, idx) => (
            <LastScanCard key={idx} lastScan={scan} />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
