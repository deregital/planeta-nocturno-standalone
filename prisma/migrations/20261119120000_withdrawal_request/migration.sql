-- Botón de arrepentimiento (Disp. SSDCyLC 954/2025): el comprador revoca una
-- compra paga desde /arrepentimiento. Las entradas pasan a la papelera en el
-- momento y la Productora le transfiere el dinero a la cuenta que cargó, y lo
-- marca desde "Arrepentimientos".

-- Cuándo se acreditó el pago: desde acá corren los 10 días. Las compras
-- anteriores quedan en NULL y usan la fecha de la reserva.
ALTER TABLE "ticketGroup" ADD COLUMN "paidAt" TIMESTAMPTZ;

CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING_REFUND', 'REFUNDED');

-- Copia los datos de la compra: el trámite queda aunque se borre la compra o
-- el evento.
CREATE TABLE "withdrawalRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Número de trámite correlativo (ARR-000123).
    "number" SERIAL NOT NULL,
    "ticketGroupId" UUID,
    "eventId" UUID,
    "eventName" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "mail" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    -- Total a devolver, cargo por servicio incluido.
    "amount" DECIMAL(14,2) NOT NULL,
    "serviceFeeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMPTZ,
    -- CBU, CVU o alias que cargó el comprador: el reintegro es por transferencia.
    "refundAccount" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING_REFUND',
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAt" TIMESTAMPTZ,
    "refundedByUserId" UUID,

    CONSTRAINT "withdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "withdrawalRequest_number_key" ON "withdrawalRequest"("number");
CREATE UNIQUE INDEX "withdrawalRequest_ticketGroupId_key" ON "withdrawalRequest"("ticketGroupId");
CREATE INDEX "withdrawalRequest_status_requestedAt_idx" ON "withdrawalRequest"("status", "requestedAt" DESC);
CREATE INDEX "withdrawalRequest_eventId_idx" ON "withdrawalRequest"("eventId");
CREATE INDEX "withdrawalRequest_refundedByUserId_idx" ON "withdrawalRequest"("refundedByUserId");

ALTER TABLE "withdrawalRequest" ADD CONSTRAINT "withdrawalRequest_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "ticketGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "withdrawalRequest" ADD CONSTRAINT "withdrawalRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "withdrawalRequest" ADD CONSTRAINT "withdrawalRequest_refundedByUserId_fkey" FOREIGN KEY ("refundedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El rol de sistema Administrador ve los arrepentimientos por defecto
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'withdrawals:manage'
FROM "accessRole"
WHERE "id" = '00000000-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;
