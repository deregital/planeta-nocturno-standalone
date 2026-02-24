import { Folder } from 'lucide-react';
import { type Route } from 'next';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

import EventCardHorizontal from '@/components/events/admin/EventCardHorizontal';
import EventFolderModal from '@/components/events/admin/EventFolderModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

export default function EventFolder({
  folder,
  href,
  showActions,
}: {
  folder: RouterOutputs['events']['getAll'][
    | 'pastEvents'
    | 'upcomingEvents']['folders'][number];
  href?: (slug: string) => string;
  showActions?: boolean;
}) {
  const session = useSession();
  const isAdmin = session?.data?.user.role === 'ADMIN';

  const isEmpty = folder.events.length === 0;

  return (
    <Accordion type='single' collapsible className='w-full'>
      <AccordionItem value='item-1' className='border-none' disabled={isEmpty}>
        <div className='relative'>
          <AccordionTrigger
            className={cn(
              'hover:no-underline py-3 px-4 gap-2 transition-all duration-200 ease-in-out rounded-lg flex items-center justify-between',
              isEmpty
                ? 'cursor-default disabled:opacity-100'
                : 'cursor-pointer',
            )}
            style={{ backgroundColor: folder.color }}
          >
            <div className='flex items-center gap-2'>
              <Folder size={20} />
              <p className='text-lg font-bold'>
                {folder.name}{' '}
                {isEmpty && <span className='text-xs'>(sin eventos)</span>}
              </p>
            </div>
          </AccordionTrigger>
          {isAdmin && (
            <div className='absolute right-10 top-1/2 -translate-y-1/2'>
              <EventFolderModal action='EDIT' folder={folder} />
            </div>
          )}
        </div>
        <AccordionContent
          contentClassName='mt-0 border-none rounded-none w-full ml-2'
          className='p-2 bg-transparent space-y-2'
        >
          {folder.events.map((event, index) =>
            href ? (
              <Link href={href(event.slug) as Route} key={index}>
                <EventCardHorizontal
                  key={index}
                  event={event}
                  showActions={showActions}
                />
              </Link>
            ) : (
              <EventCardHorizontal
                key={index}
                event={event}
                showActions={showActions}
                folderColor={folder.color}
              />
            ),
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
