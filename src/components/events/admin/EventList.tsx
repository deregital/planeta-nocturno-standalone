import { type RouterOutputs } from '@/server/routers/app';
import EventCardHorizontal from '@/components/events/admin/EventCardHorizontal';

export default function EventList({
  events,
}: {
  events: RouterOutputs['events']['getAll'];
}) {
  return (
    <div className='flex flex-col gap-4'>
      {events.map((event, index) => (
        <EventCardHorizontal key={index} event={event} />
      ))}
    </div>
  );
}
