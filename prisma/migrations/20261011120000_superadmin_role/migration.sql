-- Libera el nombre si una plataforma ya tenía un rol propio llamado igual
UPDATE "accessRole"
SET "name" = "name" || ' (personalizado)', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Superadministrador'
  AND "id" <> '00000000-0000-4000-a000-000000000006';

-- Rol de sistema oculto (id fijo: lo referencia SUPERADMIN_ACCESS_ROLE_ID en src/lib/rbac/permissions.ts).
-- Como rol de sistema con base ADMIN siempre resuelve todos los permisos del Administrador.
INSERT INTO "accessRole" ("id", "name", "description", "baseRole", "isSystem") VALUES
    ('00000000-0000-4000-a000-000000000006', 'Superadministrador', 'Usuario de soporte con acceso total. No figura en las listas de usuarios', 'ADMIN', true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission") VALUES
    ('00000000-0000-4000-a000-000000000006', 'system:superadmin')
ON CONFLICT DO NOTHING;
