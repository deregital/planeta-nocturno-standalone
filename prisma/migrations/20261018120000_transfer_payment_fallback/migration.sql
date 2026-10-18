-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MERCADO_PAGO', 'TRANSFER');

-- AlterTable
ALTER TABLE "ticketGroup" ADD COLUMN "paymentMethod" "PaymentMethod";

-- CreateTable
CREATE TABLE "paymentSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "transferAlias" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paymentSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "paymentSettings_singleton" CHECK ("id" = 1)
);

INSERT INTO "paymentSettings" ("id") VALUES (1) ON CONFLICT DO NOTHING;

-- El rol de sistema Administrador puede liberar y cancelar compras por transferencia
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'tickets:release'
FROM "accessRole"
WHERE "id" = '00000000-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;
