'use client';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import EventList from '@/components/events/admin/EventList';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  events,
}: {
  events: RouterOutputs['events']['getAll'];
}) {
  const session = useSession();
  const router = useRouter();

  return (
    <div className='flex w-full p-4 flex-col gap-6'>
      <h1 className='text-4xl font-bold text-accent'>Gestor de Eventos</h1>

      <Button
        className='w-fit py-4 px-8'
        onClick={() => router.push('/admin/event/create')}
        disabled={session.data?.user.role !== 'ADMIN'}
      >
        <Calendar /> Crear evento
      </Button>
      <EventList events={events} />
    </div>
  );
}
