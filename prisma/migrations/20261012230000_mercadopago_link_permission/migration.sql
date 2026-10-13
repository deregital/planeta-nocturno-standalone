-- "Vinculación de Mercado Pago" pasa a ser un permiso propio, independiente de
-- la configuración adicional: reemplaza a 'settings:payments'.
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "roleId", 'mercadopago:link'
FROM "accessRolePermission"
WHERE "permission" = 'settings:payments'
ON CONFLICT DO NOTHING;

-- El rol de sistema Administrador lo tiene por defecto
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'mercadopago:link'
FROM "accessRole"
WHERE "id" = '00000000-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;

DELETE FROM "accessRolePermission"
WHERE "permission" = 'settings:payments';
