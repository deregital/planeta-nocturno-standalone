-- Add nullable sortOrder to support safe backfill
ALTER TABLE "ticketType"
ADD COLUMN "sortOrder" INTEGER;

-- Speed up ordered reads during transition
CREATE INDEX "ticketType_eventId_sortOrder_idx"
ON "ticketType"("eventId", "sortOrder");
