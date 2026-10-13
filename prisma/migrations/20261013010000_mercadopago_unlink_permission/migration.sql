-- El rol de sistema Administrador puede desvincular Mercado Pago por defecto
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'mercadopago:unlink'
FROM "accessRole"
WHERE "id" = '00000000-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;
