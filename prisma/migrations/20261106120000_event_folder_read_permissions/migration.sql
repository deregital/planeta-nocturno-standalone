-- Ver carpetas de eventos pasa a ser un permiso propio, independiente de ver
-- eventos: 'events:folders_read' (carpetas de los eventos asignados) y
-- 'events:folders_read_all' (todas las carpetas). Sin ninguno, los eventos se
-- listan sin carpetas.

-- Todo rol que ve eventos ve, por defecto, las carpetas de sus eventos
-- (incluido el rol de sistema Acceso).
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "roleId", 'events:folders_read'
FROM "accessRolePermission"
WHERE "permission" = 'events:read'
ON CONFLICT DO NOTHING;

-- Los roles que ven todos los eventos o gestionan carpetas siguen viendo todas las carpetas.
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT DISTINCT "roleId", 'events:folders_read_all'
FROM "accessRolePermission"
WHERE "permission" IN ('events:read_all', 'events:folders')
ON CONFLICT DO NOTHING;

INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT DISTINCT "roleId", 'events:folders_read'
FROM "accessRolePermission"
WHERE "permission" = 'events:folders'
ON CONFLICT DO NOTHING;
