-- Escaneo con decisión local. Solo tablas nuevas: ninguna consulta existente
-- las lee, así que el código anterior sigue funcionando con o sin esta
-- migración aplicada.

-- CreateTable
CREATE TABLE "eventScannerConfig" (
    "eventId" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'off',
    "maxStaleSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" UUID,

    CONSTRAINT "eventScannerConfig_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "scanReceipt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientScanId" UUID NOT NULL,
    "eventId" UUID,
    "emittedTicketId" UUID,
    "userId" UUID,
    "deviceId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "localStatus" TEXT NOT NULL,
    "clientScannedAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredAt" TIMESTAMPTZ,

    CONSTRAINT "scanReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scanReceipt_clientScanId_key" ON "scanReceipt"("clientScanId");

-- CreateIndex
CREATE INDEX "scanReceipt_eventId_receivedAt_idx" ON "scanReceipt"("eventId", "receivedAt");

-- AddForeignKey
ALTER TABLE "eventScannerConfig" ADD CONSTRAINT "eventScannerConfig_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanReceipt" ADD CONSTRAINT "scanReceipt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
