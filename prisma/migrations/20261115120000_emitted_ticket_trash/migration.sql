-- Papelera de entradas: al eliminar una entrada se mueve acá (con el motivo)
-- en vez de borrarse. Al salir de "emittedTicket" deja de escanearse, de
-- figurar en las tablas y estadísticas y de contar para el cupo; el escáner
-- la busca acá para mostrar el motivo. Restaurarla la devuelve con el mismo id
-- (el mismo QR).
CREATE TABLE "deletedEmittedTicket" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "mail" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "instagram" TEXT,
    "birthDate" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "paidOnLocation" BOOLEAN NOT NULL DEFAULT false,
    "scanned" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMPTZ,
    "scannedByUserId" UUID,
    "ticketTypeId" UUID NOT NULL,
    "ticketGroupId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "shortId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL,
    -- Escaneos y código de invitación de la entrada, para restaurarlos.
    "scans" JSONB NOT NULL DEFAULT '[]',
    "invitation" JSONB,
    "deletionReason" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedByUserId" UUID,

    CONSTRAINT "deletedEmittedTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deletedEmittedTicket_eventId_deletedAt_idx" ON "deletedEmittedTicket"("eventId", "deletedAt" DESC);
CREATE INDEX "deletedEmittedTicket_ticketGroupId_idx" ON "deletedEmittedTicket"("ticketGroupId");
CREATE INDEX "deletedEmittedTicket_ticketTypeId_idx" ON "deletedEmittedTicket"("ticketTypeId");

ALTER TABLE "deletedEmittedTicket" ADD CONSTRAINT "deletedEmittedTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deletedEmittedTicket" ADD CONSTRAINT "deletedEmittedTicket_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "ticketGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deletedEmittedTicket" ADD CONSTRAINT "deletedEmittedTicket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deletedEmittedTicket" ADD CONSTRAINT "deletedEmittedTicket_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El rol de sistema Administrador ve la papelera por defecto
INSERT INTO "accessRolePermission" ("roleId", "permission")
SELECT "id", 'tickets:trash'
FROM "accessRole"
WHERE "id" = '00000000-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;
