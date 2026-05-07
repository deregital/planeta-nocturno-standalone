-- Backfill order per event, deterministic by createdAt then id
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY "eventId" ORDER BY "createdAt", id) AS rn
  FROM "ticketType"
)
UPDATE "ticketType" AS tt
SET "sortOrder" = ordered.rn
FROM ordered
WHERE tt.id = ordered.id;

-- Enforce required sort order after backfill
ALTER TABLE "ticketType"
ALTER COLUMN "sortOrder" SET NOT NULL;

-- Prevent duplicated positions inside the same event
CREATE UNIQUE INDEX "ticketType_eventId_sortOrder_key"
ON "ticketType"("eventId", "sortOrder");
