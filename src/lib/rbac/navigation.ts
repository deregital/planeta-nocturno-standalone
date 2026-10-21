import type { Route } from 'next';

import {
  hasAnyPermission,
  type TenantPermission,
} from '@/lib/rbac/permissions';

export const SETTINGS_PAGE_PERMISSIONS = [
  'users:read',
  'locations:read',
  'categories:read',
  'settings:read',
  'mercadopago:link',
] as const satisfies readonly TenantPermission[];

type BackofficeRoute = {
  href: Route<string>;
  title: string;
  /** Alcanza con tener uno de estos permisos para ver la ruta. */
  anyOf: readonly TenantPermission[];
};

/** Menú del backoffice, en orden: la primera ruta visible es la de inicio. */
export const BACKOFFICE_ROUTES: readonly BackofficeRoute[] = [
  {
    href: '/admin/event',
    title: 'Eventos',
    anyOf: ['events:read'],
  },
  {
    href: '/organization',
    title: 'Mis eventos',
    anyOf: ['organizer:act'],
  },
  {
    href: '/admin/database',
    title: 'Base de Datos',
    anyOf: ['database:read'],
  },
  {
    href: '/admin/users',
    title: 'Organizadores',
    anyOf: ['organizers:read'],
  },
  {
    href: '/admin/ticketing',
    title: 'Escanear',
    anyOf: ['scanner:use'],
  },
  {
    href: '/profile',
    title: 'Mis Datos',
    anyOf: ['profile:read'],
  },
  {
    href: '/admin/roles' as Route,
    title: 'Roles',
    anyOf: ['roles:read'],
  },
  {
    href: '/admin/settings',
    title: 'Configuración',
    anyOf: SETTINGS_PAGE_PERMISSIONS,
  },
];

export const NO_ACCESS_PATH = '/no-access' as Route;

export function getVisibleRoutes(permissions: readonly TenantPermission[]) {
  return BACKOFFICE_ROUTES.filter((route) =>
    hasAnyPermission(permissions, route.anyOf),
  );
}

export function getLandingPath(
  permissions: readonly TenantPermission[],
): Route {
  return getVisibleRoutes(permissions)[0]?.href ?? NO_ACCESS_PATH;
}
