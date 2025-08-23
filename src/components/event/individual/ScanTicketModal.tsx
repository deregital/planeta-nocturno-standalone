'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';
import { ScanBarcode } from 'lucide-react';
import { useRef } from 'react';

export function ScanTicketModal({ eventId }: { eventId: string }) {
  const scanMutation = trpc.emittedTickets.scan.useMutation();
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          scanMutation.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className='flex gap-x-5'>
          Escanear ticket
          <ScanBarcode className='size-5' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className='text-lg font-semibold'>
          Escanear ticket
        </DialogTitle>
        <div>
          <form
            className='flex'
            onSubmit={async (e: React.SyntheticEvent<HTMLFormElement>) => {
              const inputValue = inputRef.current?.value || '';
              if (!inputValue) {
                return;
              }
              e.preventDefault();
              await scanMutation
                .mutateAsync({
                  eventId: eventId,
                  barcode: inputValue,
                })
                .finally(() => {
                  utils.emittedTickets.getByEventId.invalidate();
                  if (inputRef.current) {
                    inputRef.current.value = '';
                    inputRef.current.focus();
                  }
                });
            }}
          >
            <Input
              ref={inputRef}
              name='barcode'
              autoComplete='off'
              className='rounded-r-none'
            />
            <Button
              className='rounded-l-none'
              type='submit'
              disabled={scanMutation.isPending}
            >
              Escanear
            </Button>
          </form>
          {scanMutation.isError && (
            <p className='font-semibold text-red-500'>
              {scanMutation.error.message}
            </p>
          )}
          {scanMutation.isSuccess && (
            <p
              className={cn(
                'font-semibold',
                scanMutation.data.success ? 'text-green-500' : 'text-red-500',
              )}
            >
              {scanMutation.data.text}{' '}
              {scanMutation.data?.extraInfo && (
                <span className='text-sm block text-gray-500'>
                  {scanMutation.data?.extraInfo}
                </span>
              )}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
