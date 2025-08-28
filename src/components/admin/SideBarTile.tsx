import { type Route } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export default function SideBarTile<T extends string>({
  title,
  icon,
  href,
  isActive,
}: {
  title: string;
  icon: ReactNode;
  href: Route<T>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex gap-2 items-center dark:text-brand text-accent hover:bg-accent/5 dark:over:bg-accent-ultra-light/5 py-2 px-4',
        isActive && 'bg-accent/10 dark:bg-accent-ultra-light/10 font-bold',
      )}
    >
      <div className='flex w-fit gap-2 items-center'>
        {icon}

        <p className='text-xl flex-1 whitespace-nowrap'>{title}</p>
      </div>
    </Link>
  );
}
