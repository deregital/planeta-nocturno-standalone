import { useState } from 'react';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { EventOrganizers } from '@/components/event/create/inviteCondition/EventOrganizers';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inviteCondition } from '@/drizzle/schema';
import { inviteConditionTranslation } from '@/lib/translations';
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

  const [tab, setTab] = useState<InviteCondition | null>(
    event.inviteCondition ?? null,
  );

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
    <div className='flex w-full flex-col gap-4'>
      {tab === null && (
        <div className='flex flex-col gap-4 w-full'>
          <Button
            className='h-32 text-xl! w-full'
            variant={'outline'}
            onClick={() =>
              handleChange(inviteCondition.enumValues[2] as InviteCondition)
            }
          >
            <span className='flex flex-col items-center justify-between gap-4'>
              Simple
              <span className='text-sm'>
                ¡Recomendado si es tu primera vez!
              </span>
            </span>
          </Button>
          <div className='flex gap-4 w-full'>
            <Button
              key={inviteCondition.enumValues[0]}
              className='h-32 text-xl! flex-1'
              variant={'outline'}
              onClick={() =>
                handleChange(inviteCondition.enumValues[0] as InviteCondition)
              }
            >
              {inviteConditionTranslation[inviteCondition.enumValues[0]]}
            </Button>
            <Button
              key={inviteCondition.enumValues[1]}
              className='h-32 text-xl! flex-1'
              variant={'outline'}
              onClick={() =>
                handleChange(inviteCondition.enumValues[1] as InviteCondition)
              }
            >
              {inviteConditionTranslation[inviteCondition.enumValues[1]]}
            </Button>
          </div>
        </div>
      )}
      {tab !== null && (
        <Tabs
          onValueChange={(value) => handleChange(value as InviteCondition)}
          value={tab}
          className='w-full overflow-x-hidden'
        >
          <TabsList className='flex-1 w-full max-w-full mx-auto overflow-x-auto [scrollbar-width:thin] justify-start'>
            <TabsTrigger
              className='flex-1'
              value={inviteCondition.enumValues[0]}
            >
              {inviteConditionTranslation[inviteCondition.enumValues[0]]}
            </TabsTrigger>
            <TabsTrigger
              className='flex-1'
              value={inviteCondition.enumValues[1]}
            >
              {inviteConditionTranslation[inviteCondition.enumValues[1]]}
            </TabsTrigger>
            <TabsTrigger
              className='flex-1'
              value={inviteCondition.enumValues[2]}
            >
              {inviteConditionTranslation[inviteCondition.enumValues[2]]}
            </TabsTrigger>
          </TabsList>
          <TabsContent value={inviteCondition.enumValues[0]}>
            <EventOrganizers type={tab} />
          </TabsContent>
          <TabsContent value={inviteCondition.enumValues[1]}>
            <EventOrganizers type={tab} />
          </TabsContent>
          <TabsContent value={inviteCondition.enumValues[2]}>
            <div className='flex justify-center items-center h-44'>
              Seleccionando esta opción se agregará un atributo
              &quot;Invita:&quot; en la ticketera. En el cual se debe ingresar
              el nombre del organizador que invita.
            </div>
          </TabsContent>
        </Tabs>
      )}
      <div className='flex w-full gap-4'>
        {back && (
          <Button className='flex-1' onClick={back} variant={'outline'}>
            Volver
          </Button>
        )}
        {tab !== null && (
          <Button className='flex-1' variant={'accent'} onClick={handleNext}>
            Continuar
          </Button>
        )}
      </div>
    </div>
  );
}
