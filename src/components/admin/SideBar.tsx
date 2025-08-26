'use client';

import { Calendar, Database, Home, MapPin } from 'lucide-react';
import { type Route } from 'next';
import { usePathname } from 'next/navigation';

import SideBarTile from '@/components/admin/SideBarTile';

export const navRoutes: {
  href: Route<string>;
  icon: React.ReactNode;
  title: string;
}[] = [
  {
    href: '/admin',
    icon: <Home />,
    title: 'Dashboard',
  },
  {
    href: '/admin/database',
    icon: <Database />,
    title: 'Base de Datos',
  },
  {
    href: '/admin/event',
    icon: <Calendar />,
    title: 'Eventos',
  },
  {
    href: '/admin/locations',
    icon: <MapPin />,
    title: 'Locaciones',
  },
];

export default function SideBar() {
  const pathname = usePathname();
  return (
    <aside className='hidden w-48 md:flex flex-col py-3 border-r-3 border-stroke/40'>
      {navRoutes.map((route, index) => (
        <SideBarTile
          key={index}
          href={route.href}
          icon={route.icon}
          title={route.title}
          isActive={pathname === route.href}
        />
      ))}
    </aside>
  );
}
