-- CreateTable
CREATE TABLE "accessRole" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRole" "Role" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessRolePermission" (
    "roleId" UUID NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "accessRolePermission_pkey" PRIMARY KEY ("roleId","permission")
);

-- AlterTable
ALTER TABLE "user" ADD COLUMN "accessRoleId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "accessRole_name_key" ON "accessRole"("name");

-- CreateIndex
CREATE INDEX "user_accessRoleId_idx" ON "user"("accessRoleId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "accessRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessRolePermission" ADD CONSTRAINT "accessRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "accessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed system roles (ids fijos: los referencia SYSTEM_ACCESS_ROLE_IDS en src/lib/rbac/permissions.ts)
INSERT INTO "accessRole" ("id", "name", "description", "baseRole", "isSystem") VALUES
    ('00000000-0000-4000-a000-000000000001', 'Administrador', 'Acceso completo a la plataforma', 'ADMIN', true),
    ('00000000-0000-4000-a000-000000000002', 'Acceso', 'Gestiona los eventos asignados: ventas, emisión y escaneo de entradas', 'TICKETING', true),
    ('00000000-0000-4000-a000-000000000003', 'Control', 'Escanea entradas en la puerta de los eventos asignados', 'CONTROL_TICKETING', true),
    ('00000000-0000-4000-a000-000000000004', 'Organizador', 'Ve sus eventos, sus ventas y su base de datos', 'ORGANIZER', true),
    ('00000000-0000-4000-a000-000000000005', 'Jefe de Organizadores', 'Organizador que además gestiona a su equipo de organizadores', 'CHIEF_ORGANIZER', true)
ON CONFLICT ("id") DO NOTHING;

-- Seed system role permissions (reproducen el acceso previo de cada tipo de usuario)
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT '00000000-0000-4000-a000-000000000001'::uuid, "permission"
FROM unnest(ARRAY[
    'events:read', 'events:read_all', 'events:statistics', 'events:create', 'events:duplicate',
    'events:update', 'events:publish', 'events:reorder', 'events:delete', 'events:folders', 'events:export',
    'tickets:read', 'tickets:create', 'tickets:resend', 'tickets:download', 'tickets:manual_scan',
    'tickets:change_organizer', 'tickets:delete', 'tickets:raffle', 'tickets:answers',
    'scanner:use',
    'database:read', 'database:read_all', 'database:emission_history',
    'organizers:read', 'organizers:read_all', 'organizers:statistics', 'organizers:create', 'organizers:import',
    'organizers:assign_role', 'organizers:update', 'organizers:delete', 'organizers:groups', 'organizers:distribute',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    'locations:read', 'locations:create', 'locations:update', 'locations:delete',
    'categories:read', 'categories:create', 'categories:update',
    'settings:read', 'settings:update', 'settings:payments',
    'statistics:read',
    'exports:tables',
    'profile:read', 'profile:update'
]) AS "permission"
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT '00000000-0000-4000-a000-000000000002'::uuid, "permission"
FROM unnest(ARRAY[
    'events:read', 'events:statistics',
    'tickets:read', 'tickets:create', 'tickets:resend', 'tickets:download',
    'tickets:manual_scan', 'tickets:raffle', 'tickets:answers',
    'scanner:use'
]) AS "permission"
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT '00000000-0000-4000-a000-000000000003'::uuid, "permission"
FROM unnest(ARRAY[
    'scanner:use',
    'exports:tables'
]) AS "permission"
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT '00000000-0000-4000-a000-000000000004'::uuid, "permission"
FROM unnest(ARRAY[
    'tickets:read', 'tickets:resend', 'tickets:download',
    'database:read',
    'my_events:read', 'my_events:invitation_codes',
    'exports:tables',
    'profile:read', 'profile:update'
]) AS "permission"
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT '00000000-0000-4000-a000-000000000005'::uuid, "permission"
FROM unnest(ARRAY[
    'tickets:read', 'tickets:resend', 'tickets:download',
    'database:read',
    'my_events:read', 'my_events:invitation_codes',
    'exports:tables',
    'profile:read', 'profile:update',
    'organizers:read', 'organizers:statistics', 'organizers:create', 'organizers:import',
    'organizers:update', 'organizers:delete', 'organizers:groups', 'organizers:distribute'
]) AS "permission"
ON CONFLICT DO NOTHING;

-- Backfill: cada usuario existente recibe el rol de sistema de su tipo
UPDATE "user"
SET "accessRoleId" = CASE "role"
    WHEN 'ADMIN' THEN '00000000-0000-4000-a000-000000000001'::uuid
    WHEN 'TICKETING' THEN '00000000-0000-4000-a000-000000000002'::uuid
    WHEN 'CONTROL_TICKETING' THEN '00000000-0000-4000-a000-000000000003'::uuid
    WHEN 'ORGANIZER' THEN '00000000-0000-4000-a000-000000000004'::uuid
    WHEN 'CHIEF_ORGANIZER' THEN '00000000-0000-4000-a000-000000000005'::uuid
END
WHERE "accessRoleId" IS NULL;
