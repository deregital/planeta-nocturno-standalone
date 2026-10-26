'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ConfirmActionDialog({
  action,
  title,
  description,
  confirmLabel,
  triggerLabel,
  pending,
  fields,
  children,
  triggerVariant = 'destructiveGhost',
  confirmVariant = 'destructive',
}: {
  action: (formData: FormData) => void;
  title: string;
  description: string;
  confirmLabel: string;
  triggerLabel: string;
  pending: boolean;
  fields: Record<string, string>;
  children: React.ReactNode;
  triggerVariant?: React.ComponentProps<typeof Button>['variant'];
  confirmVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const [open, setOpen] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type='button'
          variant={triggerVariant}
          size='icon'
          disabled={pending}
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type='button'
            variant='ghost'
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <form action={action}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type='hidden' name={name} value={value} />
            ))}
            <Button type='submit' variant={confirmVariant} loading={pending}>
              {confirmLabel}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
