import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { EventOrganizers } from '@/components/event/create/inviteCondition/EventOrganizers';
import { Button } from '@/components/ui/button';
import { inviteConditionTranslation } from '@/lib/translations';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export function EventInvitationTypeAction({
  next,
  back,
}: {
  next: () => void;
  back: () => void;
}) {
  const event = useCreateEventStore((state) => state.event);
  const organizers = useCreateEventStore((state) => state.organizers);
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const addOrganizerTicketType = useCreateEventStore(
    (state) => state.addOrganizerTicketType,
  );

  function handleNext() {
    if (!event.inviteCondition) {
      toast.error('Elegí el tipo de evento en el paso Tickets.');
      return;
    }

    if (event.inviteCondition === 'INVITATION' && organizers.length === 0) {
      toast.error(
        'Debes seleccionar al menos un organizador en modo invitación',
      );
      return;
    }

    // Asegurarse de que el ticket de organizador existe
    if (
      organizers.length > 0 &&
      !ticketTypes.some((t) => t.name === ORGANIZER_TICKET_TYPE_NAME)
    ) {
      addOrganizerTicketType();
    }

    next();
  }

  return (
    <div className='flex w-full min-w-0 max-w-full flex-col gap-4'>
      {event.inviteCondition ? (
        <>
          <p className='text-sm text-accent-dark/70'>
            Tipo de evento:{' '}
            <strong>{inviteConditionTranslation[event.inviteCondition]}</strong>
          </p>
          {event.inviteCondition === 'SIMPLE' ? (
            <div className='flex min-h-44 items-center justify-center text-center'>
              El evento Simple no requiere configurar organizadores.
            </div>
          ) : (
            <EventOrganizers type={event.inviteCondition} />
          )}
        </>
      ) : (
        <p className='text-center text-sm text-accent-dark/70'>
          Elegí primero el tipo de evento en el paso Tickets.
        </p>
      )}
      <div className='flex w-full gap-4'>
        {back && (
          <Button className='flex-1' onClick={back} variant={'outline'}>
            Volver
          </Button>
        )}
        <Button className='flex-1' variant={'accent'} onClick={handleNext}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
