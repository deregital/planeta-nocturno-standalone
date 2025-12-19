import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { InvitationTicketTypeAction } from '@/components/event/create/ticketType/InvitationTicketTypeAction';
import { TraditionalTicketTypeAction } from '@/components/event/create/ticketType/TraditionalTicketTypeAction';

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
  if (event.inviteCondition === 'TRADITIONAL') {
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
