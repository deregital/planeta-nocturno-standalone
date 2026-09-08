export const CONTROL_PERMISSIONS = [
  'tenants:read',
  'tenants:read_all',
  'tenants:create',
  'tenants:update',
  'tenants:suspend',
  'tenants:activate',
  'tenants:recycle',
  'tenants:restore',
  'admins:read',
  'admins:create',
  'admins:update',
  'admins:delete',
  'roles:read',
  'roles:create',
  'roles:update',
  'roles:delete',
] as const;

export type ControlPermission = (typeof CONTROL_PERMISSIONS)[number];

export const CONTROL_PERMISSION_LABELS: Record<ControlPermission, string> = {
  'tenants:read': 'Ver sus propias plataformas',
  'tenants:read_all': 'Ver todas las plataformas',
  'tenants:create': 'Crear plataformas',
  'tenants:update': 'Editar plataformas',
  'tenants:suspend': 'Suspender plataformas',
  'tenants:activate': 'Reactivar plataformas',
  'tenants:recycle': 'Enviar a papelera',
  'tenants:restore': 'Restaurar de papelera',
  'admins:read': 'Ver usuarios',
  'admins:create': 'Crear usuarios',
  'admins:update': 'Editar usuarios',
  'admins:delete': 'Eliminar usuarios',
  'roles:read': 'Ver roles',
  'roles:create': 'Crear roles',
  'roles:update': 'Editar roles',
  'roles:delete': 'Eliminar roles',
};

export const SUPER_ADMIN_ROLE_NAME = 'super_admin';

export const SUPER_ADMIN_PERMISSIONS: ControlPermission[] = [
  ...CONTROL_PERMISSIONS,
];

export const LIFECYCLE_PERMISSIONS = {
  suspend: 'tenants:suspend',
  activate: 'tenants:activate',
  recycle: 'tenants:recycle',
  restore: 'tenants:restore',
} as const satisfies Record<string, ControlPermission>;

export function isControlPermission(value: string): value is ControlPermission {
  return (CONTROL_PERMISSIONS as readonly string[]).includes(value);
}

export function parseControlPermissions(
  values: Iterable<string>,
): ControlPermission[] {
  const permissions = new Set<ControlPermission>();
  for (const value of values) {
    if (isControlPermission(value)) permissions.add(value);
  }
  return CONTROL_PERMISSIONS.filter((permission) =>
    permissions.has(permission),
  );
}

/** Prefijo antes de `:` — se deriva del permiso, sin lista fija de categorías. */
export function getPermissionCategory(permission: ControlPermission) {
  const separator = permission.indexOf(':');
  return separator === -1 ? permission : permission.slice(0, separator);
}

const CATEGORY_LABELS: Record<string, string> = {
  tenants: 'Plataformas',
  admins: 'Usuarios',
  roles: 'Roles',
};

export function formatPermissionCategory(category: string) {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function groupControlPermissionsByCategory(
  permissions: readonly ControlPermission[] = CONTROL_PERMISSIONS,
) {
  const groups = new Map<string, ControlPermission[]>();

  for (const permission of permissions) {
    const category = getPermissionCategory(permission);
    const current = groups.get(category);
    if (current) current.push(permission);
    else groups.set(category, [permission]);
  }

  return [...groups.entries()].map(([category, groupedPermissions]) => ({
    category,
    label: formatPermissionCategory(category),
    permissions: groupedPermissions,
  }));
}
