import { Calendar, Database, Home, MapPin } from 'lucide-react';
import { type Route } from 'next';

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
  return (
    <aside className='hidden w-48 text-pn-accent md:flex flex-col p-3 border-r-3 border-pn-gray/40 pt-24'>
      <nav className='flex flex-col gap-3'>
        {navRoutes.map((route, index) => (
          <SideBarTile
            key={index}
            href={route.href}
            icon={route.icon}
            title={route.title}
          />
        ))}
      </nav>
    </aside>
  );
}
