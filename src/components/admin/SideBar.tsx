'use client';

import { Calendar, Database, Home, Settings, Users } from 'lucide-react';
import { type Route } from 'next';
import { usePathname } from 'next/navigation';

import SideBarTile from '@/components/admin/SideBarTile';
import { type role as roleEnum } from '@/drizzle/schema';

export const navRoutes: {
  href: Route<string>;
  icon: React.ReactNode;
  title: string;
  roles: (typeof roleEnum.enumValues)[number][];
}[] = [
  {
    href: '/organization',
    icon: <Calendar />,
    title: 'Eventos',
    roles: ['ORGANIZER', 'CHIEF_ORGANIZER'],
  },
  {
    href: '/organization/database',
    icon: <Database />,
    title: 'Base de Datos',
    roles: ['ORGANIZER', 'CHIEF_ORGANIZER'],
  },
  {
    href: '/organization/organizers',
    icon: <Users />,
    title: 'Organizadores',
    roles: ['CHIEF_ORGANIZER'],
  },
  {
    href: '/admin',
    icon: <Home />,
    title: 'Dashboard',
    roles: ['ADMIN'],
  },
  {
    href: '/admin/database',
    icon: <Database />,
    title: 'Base de Datos',
    roles: ['ADMIN'],
  },
  {
    href: '/admin/event',
    icon: <Calendar />,
    title: 'Eventos',
    roles: ['ADMIN', 'TICKETING'],
  },
  // {
  //   href: '/admin/locations',
  //   icon: <MapPin />,
  //   title: 'Locaciones',
  //   roles: ['ADMIN'],
  // },
  // {
  //   href: '/admin/categories',
  //   icon: <Type />,
  //   title: 'Categorías',
  //   roles: ['ADMIN'],
  // },
  {
    href: '/admin/users',
    icon: <Users />,
    title: 'Organizadores',
    roles: ['ADMIN'],
  },
  {
    href: '/admin/settings',
    icon: <Settings />,
    title: 'Configuración',
    roles: ['ADMIN'],
  },
];

export default function SideBar({
  role,
}: {
  role: (typeof roleEnum.enumValues)[number];
}) {
  const pathname = usePathname();
  return (
    <aside className='hidden w-(--sidebar-width) md:flex flex-col py-3 min-h-full'>
      {navRoutes.map((route, index) => (
        <SideBarTile
          key={index}
          href={route.href}
          icon={route.icon}
          title={route.title}
          isActive={pathname === route.href}
          show={route.roles.includes(role)}
        />
      ))}
    </aside>
  );
}
