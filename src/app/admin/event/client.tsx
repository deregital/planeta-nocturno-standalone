'use client';
import EventList from '@/components/events/admin/EventList';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Client({
  events,
}: {
  events: RouterOutputs['events']['getAll'];
}) {
  const router = useRouter();

  return (
    <div className='flex w-full p-4 flex-col gap-6'>
      <h1 className='text-4xl font-bold'>Gestor de Eventos</h1>

      <Button
        className='w-fit bg-pn-gray text-black'
        onClick={() => router.push('/admin/event/create')}
      >
        <Calendar /> Crear evento
      </Button>
      <EventList events={events} />
    </div>
  );
}
