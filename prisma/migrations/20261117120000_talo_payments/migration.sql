-- Talo: transferencia a un CVU propio de cada compra que se confirma sola.
-- Sin fila en "paymentMethodSetting": queda activo y al final en cuanto se
-- cargan las credenciales (el valor nuevo del enum no se puede usar en la
-- misma migración).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TALO';

-- El pago en el proveedor (id de Talo) y lo que necesita ver el comprador
-- para pagarlo (CVU, alias, monto, vencimiento).
ALTER TABLE "ticketGroup" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "ticketGroup" ADD COLUMN "paymentDetails" JSONB;
CREATE INDEX "ticketGroup_paymentReference_idx" ON "ticketGroup"("paymentReference");

-- Fila única (id = 1) con la cuenta de Talo de la plataforma, conectada con
-- "Conectar con Talo" (OAuth de partner). El token se guarda cifrado.
-- "pendingSince"/"pendingByUserId": quién tocó Conectar y cuándo; sólo esa
-- persona, y por un rato, puede completar la conexión (Talo no devuelve un
-- state contra CSRF).
CREATE TABLE "taloConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "taloUserId" TEXT,
    "token" TEXT,
    "accountStatus" TEXT,
    "statusCheckedAt" TIMESTAMPTZ,
    "connectedAt" TIMESTAMPTZ,
    "pendingSince" TIMESTAMPTZ,
    "pendingByUserId" UUID,

    CONSTRAINT "taloConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "taloConnection_singleton" CHECK ("id" = 1)
);
