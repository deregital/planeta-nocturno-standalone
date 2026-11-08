'use client';
import { Lock, LockOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

/**
 * Bloquear el acceso: nadie del público entra al evento, ni por link ni por
 * invitación. Es aparte de Visible/Oculto en la ticketera.
 */
export function ToggleBlockedButton({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const [sure, setSure] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { mutate, isPending } = trpc.events.toggleBlocked.useMutation({
    onSuccess: (_data, variables) => {
      posthog.capture('event_block_changed', {
        event_id: event.id,
        is_blocked: variables.isBlocked,
      });
      toast.success(
        variables.isBlocked
          ? 'Acceso bloqueado: nadie del público puede entrar'
          : 'Acceso habilitado',
      );
      setSure(false);
      utils.events.getActiveForOrdering.invalidate();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
      setSure(false);
    },
  });

  const handleClick = () => {
    if (!sure) {
      setSure(true);
      return;
    }
    mutate({ id: event.id, isBlocked: !event.isBlocked });
  };

  return (
    <div className='flex flex-col gap-1'>
      <Button
        variant={event.isBlocked ? 'success' : 'destructive'}
        loading={isPending}
        onClick={handleClick}
        className='w-full'
      >
        {event.isBlocked ? (
          <LockOpen className='size-4' />
        ) : (
          <Lock className='size-4' />
        )}
        {sure
          ? '¿Estás seguro?'
          : event.isBlocked
            ? 'Desbloquear acceso'
            : 'Bloquear acceso'}
      </Button>
      {event.isBlocked && (
        <p className='text-center text-xs text-muted-foreground'>
          Bloqueado: no se puede entrar ni por link ni por invitación.
        </p>
      )}
    </div>
  );
}
