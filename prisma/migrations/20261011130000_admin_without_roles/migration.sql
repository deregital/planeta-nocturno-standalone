-- El rol de sistema Administrador deja de gestionar roles y permisos: queda
-- reservado al superadministrador (ver ADMIN_ACCESS_PERMISSIONS en src/lib/rbac/permissions.ts).
DELETE FROM "accessRolePermission"
WHERE "roleId" = '00000000-0000-4000-a000-000000000001'
  AND "permission" IN ('roles:read', 'roles:create', 'roles:update', 'roles:delete');

UPDATE "accessRole"
SET "description" = 'Acceso completo a la plataforma, salvo la gestión de roles y permisos',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = '00000000-0000-4000-a000-000000000001'
  AND "description" = 'Acceso completo a la plataforma';
