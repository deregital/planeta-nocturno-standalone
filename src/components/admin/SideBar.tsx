import { Calendar, Database, Home, MapPin } from 'lucide-react';
import SideBarTile from './SideBarTile';

const routes = [
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
    <aside className='w-48 text-pn-accent flex flex-col p-3 border-r-3 border-pn-gray/40 pt-24'>
      <nav className='flex flex-col gap-3'>
        {routes.map((route, index) => (
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
