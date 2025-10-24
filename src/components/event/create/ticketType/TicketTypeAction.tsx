import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { TraditionalTicketTypeAction } from '@/components/event/create/ticketType/TraditionalTicketTypeAction';
import { InvitationTicketTypeAction } from '@/components/event/create/ticketType/InvitationTicketTypeAction';

export default function TicketTypeAction({
  back,
  next,
}: {
  back?: () => void;
  next?: () => void;
}) {
  const event = useCreateEventStore((state) => state.event);
  if (event.inviteCondition === 'TRADITIONAL') {
    return <TraditionalTicketTypeAction back={back} next={next} />;
  } else {
    return <InvitationTicketTypeAction back={back} next={next} />;
  }
}
