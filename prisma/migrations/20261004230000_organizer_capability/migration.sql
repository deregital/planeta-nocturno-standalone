-- "Actúa como organizador" reúne vender como organizador y ver "Mis eventos"
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT DISTINCT "roleId", 'organizer:act'
FROM "accessRolePermission"
WHERE "permission" IN ('selling:organizer', 'my_events:read')
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "roleId", 'organizer:invitation_codes'
FROM "accessRolePermission"
WHERE "permission" = 'my_events:invitation_codes'
ON CONFLICT DO NOTHING;

-- El jefe de organizadores ahora incluye ver las ventas de su equipo
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "roleId", 'organizer:team'
FROM "accessRolePermission"
WHERE "permission" = 'selling:team'
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT t."roleId", 'organizer:team'
FROM "accessRolePermission" t
JOIN "accessRolePermission" o ON o."roleId" = t."roleId" AND o."permission" = 'selling:organizer'
WHERE t."permission" = 'tickets:read_team'
ON CONFLICT DO NOTHING;

DELETE FROM "accessRolePermission"
WHERE "permission" IN (
    'selling:organizer',
    'selling:team',
    'my_events:read',
    'my_events:invitation_codes',
    'tickets:read_team'
);

-- Mantiene el perfil derivado alineado con los permisos
UPDATE "accessRole" r
SET "baseRole" = CASE
    WHEN EXISTS (SELECT 1 FROM "accessRolePermission" p WHERE p."roleId" = r."id" AND p."permission" = 'organizer:team') THEN 'CHIEF_ORGANIZER'::"Role"
    ELSE 'ORGANIZER'::"Role"
END
WHERE EXISTS (SELECT 1 FROM "accessRolePermission" p WHERE p."roleId" = r."id" AND p."permission" = 'organizer:act');

UPDATE "user" u
SET "role" = r."baseRole"
FROM "accessRole" r
WHERE u."accessRoleId" = r."id" AND u."role" <> r."baseRole";
