'use client';

import { type Route } from 'next';
import { useRouter } from 'next/navigation';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export default function EventDetailSheet({
  title,
  description,
  closeHref,
  children,
}: {
  title: string;
  description: string;
  closeHref: Route;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.push(closeHref, { scroll: false });
      }}
    >
      <SheetContent className='w-full gap-0 overflow-y-auto bg-gray-50 sm:max-w-xl'>
        <SheetHeader className='border-b border-stroke bg-white'>
          <SheetTitle className='pr-6 text-lg'>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
