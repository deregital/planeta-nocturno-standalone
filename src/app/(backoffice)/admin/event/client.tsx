'use client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@radix-ui/react-accordion';
import { Calendar, ChevronDown } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import EventFolderModal from '@/components/events/admin/EventFolderModal';
import EventList from '@/components/events/admin/EventList';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
      <div className='flex gap-2'>
        <Button
          className='w-fit py-4 px-8'
          onClick={() => router.push('/admin/event/create')}
          disabled={session.data?.user.role !== 'ADMIN'}
        >
          <Calendar /> Crear evento
        </Button>
        <EventFolderModal action='CREATE' />
      </div>

      <p className='text-2xl font-bold text-accent'>Próximos Eventos</p>
      <EventList events={events.upcomingEvents} />
      <Separator className='border rounded-full border-accent-light' />
      <Accordion type='single' collapsible className='w-full'>
        <AccordionItem value='item-1' className='border-none'>
          <AccordionTrigger className='cursor-pointer hover:no-underline py-4 px-0 group gap-2 transition-all duration-200 ease-in-out hover:bg-gray-50/50 rounded-lg flex items-center justify-between'>
            <p className='text-2xl font-bold text-accent group-hover:text-accent/80 transition-colors duration-200'>
              Eventos Pasados
            </p>
            <ChevronDown className='h-6 w-6 text-accent transition-transform duration-200 group-data-[state=open]:rotate-180' />
          </AccordionTrigger>
          <AccordionContent className='overflow-hidden transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'>
            <div className='pt-4 pb-2'>
              <EventList events={events.pastEvents} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
