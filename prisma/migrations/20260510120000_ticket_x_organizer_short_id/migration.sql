-- AlterTable
ALTER TABLE "ticketXOrganizer" ADD COLUMN "shortId" INTEGER;

-- Backfill: stable order per event
UPDATE "ticketXOrganizer" AS t
SET "shortId" = sub.rn
FROM (
  SELECT
    "eventId",
    "code",
    ROW_NUMBER() OVER (
      PARTITION BY "eventId"
      ORDER BY "createdAt", "organizerId", "code"
    ) AS rn
  FROM "ticketXOrganizer"
) AS sub
WHERE t."eventId" = sub."eventId" AND t."code" = sub."code";

ALTER TABLE "ticketXOrganizer" ALTER COLUMN "shortId" SET NOT NULL;

CREATE UNIQUE INDEX "ticketXOrganizer_eventId_shortId_key" ON "ticketXOrganizer"("eventId", "shortId");
