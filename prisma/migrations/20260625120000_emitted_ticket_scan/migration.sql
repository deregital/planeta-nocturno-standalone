-- AlterTable
ALTER TABLE "ticketType" ADD COLUMN "allowMultipleScans" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "emittedTicketScan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "emittedTicketId" UUID NOT NULL,
    "scannedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedByUserId" UUID,

    CONSTRAINT "emittedTicketScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emittedTicketScan_emittedTicketId_idx" ON "emittedTicketScan"("emittedTicketId");

-- AddForeignKey
ALTER TABLE "emittedTicketScan" ADD CONSTRAINT "emittedTicketScan_emittedTicketId_fkey" FOREIGN KEY ("emittedTicketId") REFERENCES "emittedTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emittedTicketScan" ADD CONSTRAINT "emittedTicketScan_scannedByUserId_fkey" FOREIGN KEY ("scannedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing scans into history table
INSERT INTO "emittedTicketScan" ("emittedTicketId", "scannedAt", "scannedByUserId")
SELECT "id", "scannedAt", "scannedByUserId"
FROM "emittedTicket"
WHERE "scanned" = true AND "scannedAt" IS NOT NULL;
