'use client';
import { ArrowLeft } from 'lucide-react';
import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function GoBack({
  route,
  className,
  title,
  ...props
}: React.ComponentProps<'button'> & {
  route?: Route;
  title?: string;
}) {
  const router = useRouter();

  return (
    <Button
      onClick={() => (route ? router.push(route) : router.back())}
      variant={'ghost'}
      className={cn(
        'flex justify-center items-center gap-2 size-fit',
        className,
      )}
      {...props}
    >
      <ArrowLeft className='!h-9 !w-9' />
      {title && <span className='font-medium text-xl'>{title}</span>}
    </Button>
  );
}
