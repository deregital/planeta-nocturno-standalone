'use client';

import { useState } from 'react';

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <form action={action} onSubmit={() => setOpen(false)}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type='hidden' name={name} value={value} />
            ))}
            <Button type='submit' variant={confirmVariant} disabled={pending}>
              {confirmLabel}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
