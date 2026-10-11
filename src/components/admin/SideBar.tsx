'use client';

import {
  Calendar,
  CalendarCheck,
  Database,
  Settings,
  Shield,
  Ticket,
  UserPen,
  Users,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import SideBarTile from '@/components/admin/SideBarTile';
import { usePermissions } from '@/components/rbac/PermissionsProvider';
import { getVisibleRoutes } from '@/lib/rbac/navigation';

const routeIcons: Record<string, React.ReactNode> = {
  '/organization': <CalendarCheck />,
  '/admin/event': <Calendar />,
  '/admin/database': <Database />,
  '/admin/users': <Users />,
  '/admin/ticketing': <Ticket />,
  '/profile': <UserPen />,
  '/admin/roles': <Shield />,
  '/admin/settings': <Settings />,
};

/** Rutas del menú visibles para el usuario actual según sus permisos. */
export function useNavRoutes() {
  const { permissions } = usePermissions();

  return useMemo(
    () =>
      getVisibleRoutes([...permissions]).map((route) => ({
        ...route,
        icon: routeIcons[route.href],
      })),
    [permissions],
  );
}

export default function SideBar() {
  const pathname = usePathname();
  const routes = useNavRoutes();

  return (
    <aside className='hidden w-(--sidebar-width) md:flex flex-col py-3 min-h-full'>
      {routes.map((route) => (
        <SideBarTile
          key={route.href}
          href={route.href}
          icon={route.icon}
          title={route.title}
          isActive={pathname === route.href}
          show
        />
      ))}
    </aside>
  );
}
