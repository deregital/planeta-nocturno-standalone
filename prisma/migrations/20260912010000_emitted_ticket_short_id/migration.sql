-- AlterTable
ALTER TABLE "emittedTicket" ADD COLUMN "shortId" INTEGER;

-- Backfill: stable order per event
UPDATE "emittedTicket" AS t
SET "shortId" = sub.rn
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "eventId"
      ORDER BY "createdAt", "id"
    ) AS rn
  FROM "emittedTicket"
) AS sub
WHERE t."id" = sub."id";

ALTER TABLE "emittedTicket" ALTER COLUMN "shortId" SET NOT NULL;

CREATE UNIQUE INDEX "emittedTicket_eventId_shortId_key" ON "emittedTicket"("eventId", "shortId");
