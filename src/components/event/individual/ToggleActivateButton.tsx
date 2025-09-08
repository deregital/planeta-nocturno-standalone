'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export function ToggleActivateButton({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const [sure, setSure] = useState(false);
  const router = useRouter();
  const session = useSession();
  const isAdmin = session.data?.user.role === 'ADMIN';

  const { mutateAsync, isPending } = trpc.events.toggleActivate.useMutation();
  const handleToggle = () => {
    if (sure) {
      mutateAsync({
        id: event.id,
        isActive: !event.isActive,
      }).then(() => {
        setSure(false);
        router.refresh();
      });
      return;
    } else {
      setSure(true);
    }
  };

  return (
    <div>
      <Button
        variant={event.isActive ? 'destructive' : 'success'}
        disabled={isPending || !isAdmin}
        onClick={handleToggle}
        className='w-full'
      >
        {sure ? 'Estás seguro?' : event.isActive ? 'Desactivar' : 'Activar'}
      </Button>
    </div>
  );
}
