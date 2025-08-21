import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ticketTypeCategory } from '@/drizzle/schema';
import { trpc } from '@/server/trpc/client';
import { useMemo } from 'react';
import TicketTypeList from './TicketTypeList';
import TicketTypeModal from './TicketTypeModal';

export default function TicketTypeAction({
  back,
  next,
}: {
  back?: () => void;
  next?: () => void;
}) {
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const event = useCreateEventStore((state) => state.event);

  const { data: location } = trpc.location.getById.useQuery(event.locationId, {
    enabled: !!event.locationId,
  });

  const maxAvailableLeft = useMemo(() => {
    if (!location) return 0;
    return (
      location.capacity -
      ticketTypes.reduce((acc, t) => acc + t.maxAvailable, 0)
    );
  }, [location, ticketTypes]);

  return (
    <div className='w-full'>
      {back && (
        <Button className='self-baseline' onClick={back} variant={'outline'}>
          Volver
        </Button>
      )}
      <h2 className='text-2xl text-center'>Agregar nueva entrada</h2>
      <div className='flex items-center justify-center gap-4 my-8'>
        {ticketTypeCategory.enumValues.map((category) => (
          <TicketTypeModal
            action='CREATE'
            maxAvailableLeft={maxAvailableLeft}
            key={category}
            category={category}
          />
        ))}
      </div>
      <Separator className='my-6 bg-pn-gray' />
      <TicketTypeList
        action='EDIT'
        ticketTypes={ticketTypes}
        maxAvailableLeft={maxAvailableLeft}
      />
      {next && (
        <Button onClick={next} variant={'accent'} className='w-full mt-8'>
          Continuar
        </Button>
      )}
    </div>
  );
}
