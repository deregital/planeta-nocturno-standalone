import { useMemo } from 'react';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import TicketTypeList from '@/components/event/create/ticketType/TicketTypeList';
import TicketTypeModal from '@/components/event/create/ticketType/TicketTypeModal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ticketTypeCategory } from '@/drizzle/schema';
import { trpc } from '@/server/trpc/client';

export function TraditionalTicketTypeAction({
  back,
  next,
}: {
  back?: () => void;
  next?: () => void;
}) {
  const event = useCreateEventStore((state) => state.event);
  const organizers = useCreateEventStore((state) => state.organizers);
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);

  const { data: location } = trpc.location.getById.useQuery(event.locationId, {
    enabled: !!event.locationId,
  });

  function handleNext() {
    if (ticketTypes.length === 0) {
      toast.error('Debe agregar al menos un ticket');
      return;
    }

    next?.();
  }

  const maxAvailableLeft = useMemo(() => {
    if (!location) return 0;
    return (
      location.capacity -
      ticketTypes.reduce((acc, t) => acc + t.maxAvailable, 0)
    );
  }, [location, ticketTypes, organizers.length]);

  return (
    <div className='w-full text-accent'>
      {back && (
        <Button className='self-baseline' onClick={back} variant={'outline'}>
          Volver
        </Button>
      )}
      <h2 className='text-2xl text-center'>Agregar nuevo ticket</h2>
      <div className='flex items-center justify-center gap-4 my-8 flex-wrap'>
        {ticketTypeCategory.enumValues.map((category) => (
          <TicketTypeModal
            action='CREATE'
            maxAvailableLeft={maxAvailableLeft}
            key={category}
            category={category}
          />
        ))}
      </div>
      <Separator className='my-6 bg-stroke' />
      <TicketTypeList
        action='EDIT'
        ticketTypes={ticketTypes}
        maxAvailableLeft={maxAvailableLeft}
      />
      {next && (
        <Button onClick={handleNext} variant={'accent'} className='w-full mt-8'>
          Continuar
        </Button>
      )}
    </div>
  );
}
