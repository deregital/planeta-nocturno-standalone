import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { trpc } from '@/server/trpc/server';
import EventList from '@/components/events/admin/EventList';
import { Separator } from '@/components/ui/separator';

export default async function OrganizationPage() {
  const myEvents = await trpc.organizer.getMyEvents();
  const upcomingEvents = myEvents.filter(
    (event) => event.event.endingDate > new Date().toISOString(),
  );
  const pastEvents = myEvents.filter(
    (event) => event.event.endingDate < new Date().toISOString(),
  );
  return (
    <div className='flex flex-col gap-4 p-4'>
      <p className='text-2xl font-bold text-accent'>Próximos Eventos</p>
      {upcomingEvents.length > 0 ? (
        <EventList
          events={upcomingEvents.map((event) => event.event)}
          showActions={false}
          href={(slug) => `/organization/event/${slug}`}
        />
      ) : (
        <p className='text-lg font-medium text-accent'>
          No tenés eventos próximos
        </p>
      )}
      {pastEvents.length > 0 && (
        <>
          <Separator className='border rounded-full border-accent-light' />
          <Accordion type='single' collapsible className='w-full'>
            <AccordionItem value='item-1' className='border-none'>
              <AccordionTrigger
                chevronClassName='text-accent size-6'
                className='bg-transparent cursor-pointer hover:no-underline py-4 px-0 group gap-2 transition-all duration-200 ease-in-out hover:bg-gray-50/50 rounded-lg flex items-center justify-start'
              >
                <p className='text-2xl font-bold text-accent group-hover:text-accent/80 transition-colors duration-200'>
                  Eventos Pasados
                </p>
              </AccordionTrigger>
              <AccordionContent
                contentClassName='w-full'
                className='overflow-hidden transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'
              >
                <div className='pt-4 pb-2'>
                  <EventList
                    events={pastEvents.map((event) => event.event)}
                    showActions={false}
                    href={(slug) => `/organization/event/${slug}`}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
}

/*
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
*/
