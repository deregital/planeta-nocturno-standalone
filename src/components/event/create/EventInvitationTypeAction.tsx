import { useState } from 'react';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { EventOrganizers } from '@/components/event/create/inviteCondition/EventOrganizers';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inviteCondition } from '@/drizzle/schema';
import { type InviteCondition } from '@/server/types';
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
  const resetOrganizers = useCreateEventStore((state) => state.resetOrganizers);
  const setTicketTypes = useCreateEventStore((state) => state.setTicketTypes);
  const setEvent = useCreateEventStore((state) => state.setEvent);
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const addOrganizerTicketType = useCreateEventStore(
    (state) => state.addOrganizerTicketType,
  );

  const [tab, setTab] = useState<InviteCondition>(event.inviteCondition);

  function handleChange(value: InviteCondition) {
    setTab(value);
    setEvent({ inviteCondition: value });
    resetOrganizers();
    setTicketTypes([]);
  }

  function handleNext() {
    if (tab === 'INVITATION' && organizers.length === 0) {
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
    <div>
      <Tabs
        onValueChange={(value) => handleChange(value as InviteCondition)}
        value={tab}
        className='w-[calc(100vw-40px)] md:w-[calc(100vw-40px-var(--sidebar-width))] mt-4 overflow-x-hidden'
      >
        <TabsList className='flex-1 w-full max-w-full mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
          <TabsTrigger className='flex-1' value={inviteCondition.enumValues[0]}>
            Tradicional
          </TabsTrigger>
          <TabsTrigger className='flex-1' value={inviteCondition.enumValues[1]}>
            Invitación
          </TabsTrigger>
        </TabsList>
        <TabsContent value={inviteCondition.enumValues[0]}>
          <EventOrganizers type={tab} />
        </TabsContent>
        <TabsContent value={inviteCondition.enumValues[1]}>
          <EventOrganizers type={tab} />
        </TabsContent>
      </Tabs>
      <div className='flex flex-1 mt-4 w-full gap-4'>
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
