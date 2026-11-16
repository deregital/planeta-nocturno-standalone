-- Medios de pago: una fila por medio con si está activo y su orden. Que un
-- medio esté configurado (Mercado Pago vinculado, alias cargado) se sigue
-- leyendo de donde está; acá sólo se decide si se ofrece y en qué orden.
CREATE TABLE "paymentMethodSetting" (
    "method" "PaymentMethod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paymentMethodSetting_pkey" PRIMARY KEY ("method"),
    CONSTRAINT "paymentMethodSetting_not_on_site" CHECK ("method" <> 'ON_SITE')
);

-- Como hasta ahora: primero Mercado Pago y, si falla, transferencia.
INSERT INTO "paymentMethodSetting" ("method", "enabled", "sortOrder")
VALUES ('MERCADO_PAGO', true, 0), ('TRANSFER', true, 1)
ON CONFLICT DO NOTHING;

-- Los permisos de Mercado Pago pasan a ser de medios de pago.
UPDATE "accessRolePermission" SET "permission" = 'payments:manage'
WHERE "permission" = 'mercadopago:link';
UPDATE "accessRolePermission" SET "permission" = 'payments:unlink'
WHERE "permission" = 'mercadopago:unlink';
