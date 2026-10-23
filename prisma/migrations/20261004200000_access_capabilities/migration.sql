-- Todo usuario tiene un rol: el de sistema de su tipo si todavía no tenía uno
UPDATE "user"
SET "accessRoleId" = CASE "role"
    WHEN 'ADMIN' THEN '00000000-0000-4000-a000-000000000001'::uuid
    WHEN 'TICKETING' THEN '00000000-0000-4000-a000-000000000002'::uuid
    WHEN 'CONTROL_TICKETING' THEN '00000000-0000-4000-a000-000000000003'::uuid
    WHEN 'ORGANIZER' THEN '00000000-0000-4000-a000-000000000004'::uuid
    WHEN 'CHIEF_ORGANIZER' THEN '00000000-0000-4000-a000-000000000005'::uuid
END
WHERE "accessRoleId" IS NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "accessRoleId" SET NOT NULL;

-- Capacidades que antes dependían del tipo de usuario
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'selling:organizer'
FROM "accessRole"
WHERE "baseRole" IN ('ORGANIZER', 'CHIEF_ORGANIZER')
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'selling:team'
FROM "accessRole"
WHERE "baseRole" = 'CHIEF_ORGANIZER'
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'events:staff'
FROM "accessRole"
WHERE "baseRole" IN ('TICKETING', 'CONTROL_TICKETING')
ON CONFLICT DO NOTHING;

-- Alcance de la lista de ventas: el staff veía todo y el jefe, a su equipo
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT r."id", 'tickets:read_all'
FROM "accessRole" r
JOIN "accessRolePermission" p ON p."roleId" = r."id" AND p."permission" = 'tickets:read'
WHERE r."baseRole" IN ('ADMIN', 'TICKETING', 'CONTROL_TICKETING')
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT r."id", 'tickets:read_team'
FROM "accessRole" r
JOIN "accessRolePermission" p ON p."roleId" = r."id" AND p."permission" = 'tickets:read'
WHERE r."baseRole" = 'CHIEF_ORGANIZER'
ON CONFLICT DO NOTHING;

-- El Administrador conserva todos los permisos de acceso
INSERT INTO "accessRolePermission" ("roleId", "permission") VALUES
    ('00000000-0000-4000-a000-000000000001', 'tickets:read_team'),
    ('00000000-0000-4000-a000-000000000001', 'tickets:read_all')
ON CONFLICT DO NOTHING;
