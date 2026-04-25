-- AlterTable
ALTER TABLE "account" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "emittedTicket" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "event" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventCategory" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventFolder" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventXOrganizer" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "feature" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "location" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketGroup" ADD COLUMN     "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill totalAmount for existing ticket groups.
-- Formula aligned with calculateTotalPriceFromData:
-- total = subtotal*(1-discount/100) + subtotal*(serviceFee/100)
WITH group_amounts AS (
  SELECT
    tg.id AS ticket_group_id,
    COALESCE(
      SUM(
        (ttpg.amount::numeric) * (COALESCE(tt.price, 0)::numeric)
      ),
      0
    ) AS subtotal,
    COALESCE(e."serviceFee", 0)::numeric AS service_fee_percentage,
    COALESCE(eo."discountPercentage", 0)::numeric AS discount_percentage
  FROM "ticketGroup" tg
  LEFT JOIN "ticketTypePerGroup" ttpg ON ttpg."ticketGroupId" = tg.id
  LEFT JOIN "ticketType" tt ON tt.id = ttpg."ticketTypeId"
  LEFT JOIN "event" e ON e.id = tg.event_id
  LEFT JOIN "eventXOrganizer" eo
    ON eo."eventId" = tg.event_id
   AND eo."organizerId" = tg."invitedById"
  GROUP BY tg.id, e."serviceFee", eo."discountPercentage"
)
UPDATE "ticketGroup" tg
SET "totalAmount" = ROUND(
  (ga.subtotal * (1 - (ga.discount_percentage / 100)))
  + (ga.subtotal * (ga.service_fee_percentage / 100)),
  2
)
FROM group_amounts ga
WHERE ga.ticket_group_id = tg.id;

-- AlterTable
ALTER TABLE "ticketType" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "slug" SET DEFAULT upper(substr(md5(random()::text), 1, 6)),
ALTER COLUMN "sortOrder" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "ticketXOrganizer" ALTER COLUMN "code" SET DEFAULT upper(substr(md5(random()::text), 1, 6)),
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "code" SET DEFAULT upper(substr(md5(random()::text), 1, 6));
