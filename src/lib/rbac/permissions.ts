import type { TenantRole } from '@/lib/auth/roles';

export const TENANT_ROLES = [
  'ADMIN',
  'TICKETING',
  'CONTROL_TICKETING',
  'ORGANIZER',
  'CHIEF_ORGANIZER',
] as const satisfies readonly TenantRole[];

type PermissionDefinition = {
  key: string;
  label: string;
  description?: string;
  /** Un permiso hijo exige al padre: al otorgarlo se otorga también el padre. */
  parent?: string;
  /**
   * Las capacidades describen qué es el usuario dentro del negocio (p. ej.
   * organizador) en lugar de a qué accede: no forman parte de "todos los
   * permisos" del rol Administrador y otorgarlas no cuenta como escalada.
   */
  capability?: true;
  /**
   * No aparece en la matriz de roles ni se puede otorgar desde la plataforma:
   * solo lo tienen los roles que crean las migraciones.
   */
  hidden?: true;
};

/**
 * Catálogo de permisos de las plataformas, ordenado como árbol (cada padre
 * aparece antes que sus hijos). Las claves se guardan en la base de datos:
 * renombrar una clave exige una migración.
 */
export const TENANT_PERMISSION_DEFINITIONS = [
  // Eventos
  {
    key: 'events:read',
    label: 'Ver eventos asignados',
    description: 'Acceso al gestor de eventos y a la gestión de cada evento',
  },
  {
    key: 'events:read_all',
    label: 'Ver todos los eventos',
    description: 'Sin este permiso solo se ven los eventos asignados',
    parent: 'events:read',
  },
  {
    key: 'events:statistics',
    label: 'Ver métricas del evento',
    description: 'Cantidad de entradas emitidas y disponibles',
    parent: 'events:read',
  },
  {
    key: 'events:create',
    label: 'Crear eventos',
    parent: 'events:read',
  },
  {
    key: 'events:duplicate',
    label: 'Duplicar eventos',
    parent: 'events:create',
  },
  {
    key: 'events:update',
    label: 'Editar eventos',
    parent: 'events:read',
  },
  {
    key: 'events:publish',
    label: 'Activar y desactivar eventos',
    parent: 'events:update',
  },
  {
    key: 'events:reorder',
    label: 'Ordenar eventos en la ticketera',
    parent: 'events:update',
  },
  {
    key: 'events:delete',
    label: 'Eliminar eventos',
    parent: 'events:read',
  },
  {
    key: 'events:folders',
    label: 'Gestionar carpetas de eventos',
    parent: 'events:read',
  },
  {
    key: 'events:export',
    label: 'Descargar listados de asistencia y Excel',
    parent: 'events:read',
  },
  {
    key: 'events:staff',
    label: 'Puede ser asignado como personal de un evento',
    description: 'Aparece en la lista de personal al crear o editar un evento',
    capability: true,
  },

  // Entradas
  {
    key: 'tickets:read',
    label: 'Ver lista de ventas',
    description:
      'Sin "Ver todas" solo se ven las entradas propias (y las del equipo si es jefe de organizadores)',
  },
  {
    key: 'tickets:read_all',
    label: 'Ver todas las ventas del evento',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:create',
    label: 'Emitir entradas',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:resend',
    label: 'Reenviar entradas por mail',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:download',
    label: 'Descargar entradas en PDF',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:manual_scan',
    label: 'Marcar ingreso manual',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:change_organizer',
    label: 'Cambiar el organizador de una entrada',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:delete',
    label: 'Eliminar entradas',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:raffle',
    label: 'Realizar sorteos',
    parent: 'tickets:read',
  },
  {
    key: 'tickets:answers',
    label: 'Ver respuestas del formulario',
    parent: 'tickets:read',
  },

  // Escaneo
  {
    key: 'scanner:use',
    label: 'Escanear entradas',
  },

  // Base de datos
  {
    key: 'database:read',
    label: 'Ver base de datos de compradores',
    description: 'Sin "Ver todos" solo se ven los compradores propios',
  },
  {
    key: 'database:read_all',
    label: 'Ver todos los compradores',
    parent: 'database:read',
  },
  {
    key: 'database:emission_history',
    label: 'Ver historial de emisiones',
    parent: 'database:read',
  },

  // Organizadores
  {
    key: 'organizers:read',
    label: 'Ver organizadores',
    description: 'Sin "Ver todos" solo se ve al propio equipo',
  },
  {
    key: 'organizers:read_all',
    label: 'Ver todos los organizadores',
    parent: 'organizers:read',
  },
  {
    key: 'organizers:statistics',
    label: 'Ver estadísticas de organizadores',
    parent: 'organizers:read',
  },
  {
    key: 'organizers:create',
    label: 'Crear organizadores',
    parent: 'organizers:read',
  },
  {
    key: 'organizers:import',
    label: 'Importar organizadores desde Excel',
    parent: 'organizers:create',
  },
  {
    key: 'organizers:assign_role',
    label: 'Elegir el rol de los organizadores',
    description: 'Sin este permiso se crean con el rol Organizador',
    parent: 'organizers:create',
  },
  {
    key: 'organizers:update',
    label: 'Editar organizadores',
    description: 'Datos, links y contraseña',
    parent: 'organizers:read',
  },
  {
    key: 'organizers:delete',
    label: 'Eliminar organizadores',
    parent: 'organizers:read',
  },
  {
    key: 'organizers:groups',
    label: 'Gestionar grupos de organizadores',
    parent: 'organizers:read',
  },
  {
    key: 'organizers:distribute',
    label: 'Redistribuir invitaciones entre organizadores',
    parent: 'organizers:read',
  },

  // Actúa como organizador
  {
    key: 'organizer:act',
    label: 'Actúa como organizador',
    description:
      'Tiene código de venta, se lo puede asignar a eventos, figura en la lista de organizadores y ve "Mis eventos" con sus ventas',
    capability: true,
  },
  {
    key: 'organizer:invitation_codes',
    label: 'Ver y compartir códigos de invitación',
    parent: 'organizer:act',
    capability: true,
  },
  {
    key: 'organizer:team',
    label: 'Jefe de organizadores',
    description:
      'Puede tener organizadores a cargo, ve las ventas de su equipo y redistribuye invitaciones en sus eventos',
    parent: 'organizer:act',
    capability: true,
  },

  // Usuarios
  {
    key: 'users:read',
    label: 'Ver usuarios',
  },
  {
    key: 'users:create',
    label: 'Crear usuarios',
    parent: 'users:read',
  },
  {
    key: 'users:update',
    label: 'Editar usuarios',
    description: 'Datos, rol y contraseña',
    parent: 'users:read',
  },
  {
    key: 'users:delete',
    label: 'Eliminar usuarios',
    parent: 'users:read',
  },

  // Roles
  {
    key: 'roles:read',
    label: 'Ver roles y permisos',
  },
  {
    key: 'roles:create',
    label: 'Crear roles',
    parent: 'roles:read',
  },
  {
    key: 'roles:update',
    label: 'Editar roles',
    parent: 'roles:read',
  },
  {
    key: 'roles:delete',
    label: 'Eliminar roles',
    parent: 'roles:read',
  },

  // Locaciones
  {
    key: 'locations:read',
    label: 'Ver locaciones',
  },
  {
    key: 'locations:create',
    label: 'Crear locaciones',
    parent: 'locations:read',
  },
  {
    key: 'locations:update',
    label: 'Editar locaciones',
    parent: 'locations:read',
  },
  {
    key: 'locations:delete',
    label: 'Eliminar locaciones',
    parent: 'locations:read',
  },

  // Categorías
  {
    key: 'categories:read',
    label: 'Ver categorías',
  },
  {
    key: 'categories:create',
    label: 'Crear categorías',
    parent: 'categories:read',
  },
  {
    key: 'categories:update',
    label: 'Editar, activar y ordenar categorías',
    parent: 'categories:read',
  },

  // Configuración
  {
    key: 'settings:read',
    label: 'Ver configuración adicional',
  },
  {
    key: 'settings:update',
    label: 'Editar configuración adicional',
    parent: 'settings:read',
  },

  // Mercado Pago
  {
    key: 'mercadopago:link',
    label: 'Vinculación de Mercado Pago',
    description:
      'Conectar la cuenta de Mercado Pago en la que se acreditan los cobros de las entradas',
  },
  {
    key: 'mercadopago:unlink',
    label: 'Desvincular Mercado Pago',
    description:
      'Desconectar la cuenta de Mercado Pago. Se confirma desde un link enviado por mail',
    parent: 'mercadopago:link',
  },

  // Estadísticas
  {
    key: 'statistics:read',
    label: 'Ver estadísticas generales',
  },

  // Exportaciones
  {
    key: 'exports:tables',
    label: 'Exportar tablas a Excel',
  },

  // Perfil
  {
    key: 'profile:read',
    label: 'Ver mis datos',
  },
  {
    key: 'profile:update',
    label: 'Editar mis datos',
    parent: 'profile:read',
  },

  // Sistema
  {
    key: 'system:superadmin',
    label: 'Superadministrador',
    description:
      'Usuario de soporte: tiene todos los permisos y no figura en las listas de usuarios',
    hidden: true,
  },
] as const satisfies readonly PermissionDefinition[];

export type TenantPermission =
  (typeof TENANT_PERMISSION_DEFINITIONS)[number]['key'];

export const TENANT_PERMISSIONS: readonly TenantPermission[] =
  TENANT_PERMISSION_DEFINITIONS.map((definition) => definition.key);

type TenantPermissionDefinition = Omit<PermissionDefinition, 'parent'> & {
  key: TenantPermission;
  parent?: TenantPermission;
};

const definitionsByKey = new Map<TenantPermission, TenantPermissionDefinition>(
  TENANT_PERMISSION_DEFINITIONS.map((definition) => [
    definition.key,
    definition as TenantPermissionDefinition,
  ]),
);

const childrenByKey = new Map<TenantPermission, TenantPermission[]>();
for (const definition of definitionsByKey.values()) {
  if (!definition.parent) continue;
  const siblings = childrenByKey.get(definition.parent);
  if (siblings) siblings.push(definition.key);
  else childrenByKey.set(definition.parent, [definition.key]);
}

export function isTenantPermission(value: string): value is TenantPermission {
  return definitionsByKey.has(value as TenantPermission);
}

export function getPermissionDefinition(permission: TenantPermission) {
  return definitionsByKey.get(permission)!;
}

export function getPermissionLabel(permission: TenantPermission) {
  return getPermissionDefinition(permission).label;
}

export function getPermissionAncestors(
  permission: TenantPermission,
): TenantPermission[] {
  const ancestors: TenantPermission[] = [];
  let current = definitionsByKey.get(permission)?.parent;
  while (current) {
    ancestors.push(current);
    current = definitionsByKey.get(current)?.parent;
  }
  return ancestors;
}

export function getPermissionDescendants(
  permission: TenantPermission,
): TenantPermission[] {
  const descendants: TenantPermission[] = [];
  const pending = [...(childrenByKey.get(permission) ?? [])];
  while (pending.length > 0) {
    const current = pending.shift()!;
    descendants.push(current);
    pending.push(...(childrenByKey.get(current) ?? []));
  }
  return descendants;
}

export function getPermissionDepth(permission: TenantPermission) {
  return getPermissionAncestors(permission).length;
}

export function isCapability(permission: TenantPermission) {
  return getPermissionDefinition(permission).capability === true;
}

export function isHiddenPermission(permission: TenantPermission) {
  return getPermissionDefinition(permission).hidden === true;
}

/**
 * Deja solo permisos conocidos y agrega los ancestros de cada uno (crear
 * implica ver). Devuelve el resultado en el orden del catálogo.
 */
export function normalizePermissions(
  values: Iterable<string>,
): TenantPermission[] {
  const selected = new Set<TenantPermission>();

  for (const value of values) {
    if (!isTenantPermission(value)) continue;
    selected.add(value);
    for (const ancestor of getPermissionAncestors(value)) {
      selected.add(ancestor);
    }
  }

  return TENANT_PERMISSIONS.filter((permission) => selected.has(permission));
}

/** Activa un permiso con sus ancestros o lo desactiva junto a sus descendientes. */
export function togglePermission(
  current: readonly TenantPermission[],
  permission: TenantPermission,
  enabled: boolean,
): TenantPermission[] {
  const next = new Set(current);
  if (enabled) {
    next.add(permission);
    for (const ancestor of getPermissionAncestors(permission)) {
      next.add(ancestor);
    }
  } else {
    next.delete(permission);
    for (const descendant of getPermissionDescendants(permission)) {
      next.delete(descendant);
    }
  }
  return TENANT_PERMISSIONS.filter((item) => next.has(item));
}

export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  events: 'Eventos',
  tickets: 'Entradas',
  scanner: 'Escaneo',
  database: 'Base de datos',
  organizers: 'Organizadores',
  organizer: 'Actúa como organizador',
  users: 'Usuarios',
  roles: 'Roles y permisos',
  locations: 'Locaciones',
  categories: 'Categorías',
  settings: 'Configuración',
  mercadopago: 'Mercado Pago',
  statistics: 'Estadísticas',
  exports: 'Exportaciones',
  profile: 'Mi perfil',
};

export function getPermissionModule(permission: TenantPermission) {
  const separator = permission.indexOf(':');
  return separator === -1 ? permission : permission.slice(0, separator);
}

export function groupPermissionsByModule(
  permissions: readonly TenantPermission[] = TENANT_PERMISSIONS,
) {
  const groups = new Map<string, TenantPermission[]>();
  for (const permission of permissions) {
    if (isHiddenPermission(permission)) continue;
    const moduleKey = getPermissionModule(permission);
    const current = groups.get(moduleKey);
    if (current) current.push(permission);
    else groups.set(moduleKey, [permission]);
  }

  return [...groups.entries()].map(([moduleKey, groupedPermissions]) => ({
    module: moduleKey,
    label: PERMISSION_MODULE_LABELS[moduleKey] ?? moduleKey,
    permissions: groupedPermissions,
  }));
}

/**
 * Rol de sistema que no se puede editar: siempre tiene los permisos de acceso
 * del Administrador (todos si además es superadministrador).
 */
export const LOCKED_SYSTEM_ROLE: TenantRole = 'ADMIN';

export const SYSTEM_ACCESS_ROLE_IDS: Record<TenantRole, string> = {
  ADMIN: '00000000-0000-4000-a000-000000000001',
  TICKETING: '00000000-0000-4000-a000-000000000002',
  CONTROL_TICKETING: '00000000-0000-4000-a000-000000000003',
  ORGANIZER: '00000000-0000-4000-a000-000000000004',
  CHIEF_ORGANIZER: '00000000-0000-4000-a000-000000000005',
};

/**
 * Rol de sistema oculto del superadministrador: tiene todos los permisos de
 * acceso (incluidos los que el Administrador no tiene, como roles) y sus
 * usuarios no figuran en ninguna lista. Lo crea una migración y solo se asigna
 * al aprovisionar la plataforma.
 */
export const SUPERADMIN_ACCESS_ROLE_ID = '00000000-0000-4000-a000-000000000006';

/** Todos los permisos de acceso: las capacidades se otorgan explícitamente. */
export const ALL_ACCESS_PERMISSIONS: readonly TenantPermission[] =
  normalizePermissions(
    TENANT_PERMISSIONS.filter(
      (permission) =>
        !isCapability(permission) &&
        !isHiddenPermission(permission) &&
        getPermissionAncestors(permission).every(
          (ancestor) => !isCapability(ancestor),
        ),
    ),
  );

/** Módulos reservados al superadministrador: el Administrador no los tiene por defecto. */
const SUPERADMIN_ONLY_MODULES = new Set(['roles']);

export const ADMIN_ACCESS_PERMISSIONS: readonly TenantPermission[] =
  ALL_ACCESS_PERMISSIONS.filter(
    (permission) =>
      !SUPERADMIN_ONLY_MODULES.has(getPermissionModule(permission)),
  );

const ORGANIZER_SYSTEM_PERMISSIONS = [
  'organizer:act',
  'organizer:invitation_codes',
  'tickets:read',
  'tickets:resend',
  'tickets:download',
  'database:read',
  'exports:tables',
  'profile:read',
  'profile:update',
] as const satisfies readonly TenantPermission[];

/**
 * Permisos de los roles de sistema: reproducen lo que cada tipo de usuario
 * podía hacer antes del RBAC. Deben coincidir con las migraciones que los crean.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<
  TenantRole,
  readonly TenantPermission[]
> = {
  ADMIN: ADMIN_ACCESS_PERMISSIONS,
  TICKETING: [
    'events:read',
    'events:statistics',
    'events:staff',
    'tickets:read',
    'tickets:read_all',
    'tickets:create',
    'tickets:resend',
    'tickets:download',
    'tickets:manual_scan',
    'tickets:raffle',
    'tickets:answers',
    'scanner:use',
  ],
  CONTROL_TICKETING: ['events:staff', 'scanner:use', 'exports:tables'],
  ORGANIZER: ORGANIZER_SYSTEM_PERMISSIONS,
  CHIEF_ORGANIZER: [
    ...ORGANIZER_SYSTEM_PERMISSIONS,
    'organizer:team',
    'organizers:read',
    'organizers:statistics',
    'organizers:create',
    'organizers:import',
    'organizers:update',
    'organizers:delete',
    'organizers:groups',
    'organizers:distribute',
  ],
};

/**
 * Perfil equivalente al antiguo tipo de usuario. Solo mantiene completa la
 * columna `user.role` (y `accessRole.baseRole`) mientras exista: ninguna
 * autorización debe depender de él.
 */
export function deriveLegacyRole(
  permissions: readonly TenantPermission[],
): TenantRole {
  if (permissions.includes('organizer:team')) return 'CHIEF_ORGANIZER';
  if (permissions.includes('organizer:act')) return 'ORGANIZER';
  if (
    permissions.some(
      (permission) =>
        permission.startsWith('users:') ||
        permission.startsWith('roles:') ||
        permission.startsWith('settings:') ||
        permission.startsWith('mercadopago:'),
    )
  ) {
    return 'ADMIN';
  }
  if (permissions.includes('events:read')) return 'TICKETING';
  return 'CONTROL_TICKETING';
}

/** Qué entradas de un evento ve el usuario en la lista de ventas. */
export type TicketScope = 'own' | 'team' | 'all';

export function getTicketScope(
  permissions: readonly TenantPermission[] | ReadonlySet<TenantPermission>,
): TicketScope {
  if (hasPermission(permissions, 'tickets:read_all')) return 'all';
  if (hasPermission(permissions, 'organizer:team')) return 'team';
  return 'own';
}

export function hasPermission(
  permissions: readonly TenantPermission[] | ReadonlySet<TenantPermission>,
  permission: TenantPermission,
) {
  return 'has' in permissions
    ? permissions.has(permission)
    : permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly TenantPermission[] | ReadonlySet<TenantPermission>,
  required: readonly TenantPermission[],
) {
  return required.some((permission) => hasPermission(permissions, permission));
}
