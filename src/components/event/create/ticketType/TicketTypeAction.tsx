import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { InvitationTicketTypeAction } from '@/components/event/create/ticketType/InvitationTicketTypeAction';
import { TraditionalTicketTypeAction } from '@/components/event/create/ticketType/TraditionalTicketTypeAction';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inviteConditionTranslation } from '@/lib/translations';
import { type InviteCondition } from '@/server/types';

type TicketTypeActionProps =
  | {
      action: 'CREATE';
      next: () => void;
      back?: () => void;
    }
  | {
      action: 'EDIT';
      next?: never;
      back?: never;
    };

export default function TicketTypeAction({
  action,
  back,
  next,
}: TicketTypeActionProps) {
  const event = useCreateEventStore((state) => state.event);
  const setEvent = useCreateEventStore((state) => state.setEvent);
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const setTicketTypes = useCreateEventStore((state) => state.setTicketTypes);
  const resetOrganizers = useCreateEventStore((state) => state.resetOrganizers);

  function selectType(value: InviteCondition) {
    const previous = event.inviteCondition;
    if (previous === value) return;

    const changesTicketStructure =
      previous !== null &&
      (previous === 'INVITATION') !== (value === 'INVITATION');

    if (changesTicketStructure && ticketTypes.length > 0) {
      setTicketTypes([]);
    }

    resetOrganizers();
    setEvent({ inviteCondition: value });
  }

  if (action === 'CREATE' && event.inviteCondition === null) {
    return (
      <div className='flex w-full flex-col gap-4 text-accent'>
        {back && (
          <Button className='self-baseline' onClick={back} variant='outline'>
            Volver
          </Button>
        )}
        <div className='text-center'>
          <h2 className='text-2xl'>Elegí el tipo de evento</h2>
          <p className='mt-1 text-sm text-accent-dark/70'>
            Esta elección define cómo se configuran los tickets y organizadores.
          </p>
        </div>
        <div className='flex w-full flex-col gap-4'>
          <Button
            type='button'
            variant='outline'
            className='h-32 w-full text-xl!'
            onClick={() => selectType('SIMPLE')}
          >
            <span className='flex flex-col items-center gap-4'>
              {inviteConditionTranslation.SIMPLE}
              <span className='text-sm font-normal'>
                ¡Recomendado si es tu primera vez usando el sistema!
              </span>
            </span>
          </Button>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {(['TRADITIONAL', 'INVITATION'] as const).map((type) => (
              <Button
                key={type}
                type='button'
                variant='outline'
                className='h-32 text-xl!'
                onClick={() => selectType(type)}
              >
                {inviteConditionTranslation[type]}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (action === 'CREATE' && event.inviteCondition !== null) {
    return (
      <div className='flex w-full flex-col gap-4'>
        <Tabs
          value={event.inviteCondition}
          onValueChange={(value) => selectType(value as InviteCondition)}
          className='w-full'
        >
          <TabsList className='flex w-full overflow-x-auto [scrollbar-width:thin]'>
            {(['SIMPLE', 'TRADITIONAL', 'INVITATION'] as const).map((type) => (
              <TabsTrigger key={type} value={type} className='flex-1'>
                {inviteConditionTranslation[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {event.inviteCondition === 'INVITATION' ? (
          <InvitationTicketTypeAction
            action='CREATE'
            back={back}
            next={next!}
          />
        ) : (
          <TraditionalTicketTypeAction back={back} next={next} />
        )}
      </div>
    );
  }

  if (
    event.inviteCondition === 'TRADITIONAL' ||
    event.inviteCondition === 'SIMPLE'
  ) {
    return <TraditionalTicketTypeAction back={back} next={next} />;
  } else {
    if (action === 'CREATE') {
      return (
        <InvitationTicketTypeAction action='CREATE' back={back} next={next!} />
      );
    } else {
      return <InvitationTicketTypeAction action='EDIT' />;
    }
  }
}
