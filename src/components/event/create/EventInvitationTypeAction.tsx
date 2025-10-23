import { useState } from 'react';

import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { Tabs, TabsTrigger, TabsList, TabsContent } from '@/components/ui/tabs';
import { type InviteCondition } from '@/server/types';
import { inviteCondition } from '@/drizzle/schema';
import { EventInvitation } from '@/components/event/create/inviteCondition/EventInvitation';
import { EventTraditional } from '@/components/event/create/inviteCondition/EventTraditional';
import { Button } from '@/components/ui/button';

export function EventInvitationTypeAction({
  next,
  back,
}: {
  next: () => void;
  back: () => void;
}) {
  const event = useCreateEventStore((state) => state.event);
  const resetOrganizers = useCreateEventStore((state) => state.resetOrganizers);
  const setEvent = useCreateEventStore((state) => state.setEvent);

  const [tab, setTab] = useState<InviteCondition>(event.inviteContidtion);

  function handleChange(value: InviteCondition) {
    setTab(value);
    setEvent({ inviteContidtion: value });
    resetOrganizers();
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
          <EventTraditional />
        </TabsContent>
        <TabsContent value={inviteCondition.enumValues[1]}>
          <EventInvitation />
        </TabsContent>
      </Tabs>
      <div className='flex flex-1 mt-4 w-full gap-4'>
        {back && (
          <Button className='flex-1' onClick={back} variant={'outline'}>
            Volver
          </Button>
        )}
        <Button
          className='flex-1'
          variant={'accent'}
          onClick={() => {
            next();
          }}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
