import { type Route } from 'next';
import Link from 'next/link';
import { type ReactNode } from 'react';

export default function SideBarTile<T extends string>({
  title,
  icon,
  href,
}: {
  title: string;
  icon: ReactNode;
  href: Route<T>;
}) {
  return (
    <Link href={href} className='flex gap-2 items-center'>
      {icon}
      <p className='text-xl'>{title}</p>
    </Link>
  );
}
