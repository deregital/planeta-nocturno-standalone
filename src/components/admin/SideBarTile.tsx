import Link from 'next/link';
import { type ReactNode } from 'react';

export default function SideBarTile({
  title,
  icon,
  href,
}: {
  title: string;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className='flex gap-2 items-center'>
      {icon}
      <p className='text-xl'>{title}</p>
    </Link>
  );
}
