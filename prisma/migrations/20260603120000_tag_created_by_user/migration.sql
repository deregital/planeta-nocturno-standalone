-- Add tag ownership: each user only sees/manages tags they created
ALTER TABLE "tag" ADD COLUMN "createdById" UUID;

-- Backfill existing tags to the oldest admin (fallback: oldest user)
UPDATE "tag"
SET "createdById" = COALESCE(
  (SELECT id FROM "user" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT id FROM "user" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "createdById" IS NULL;

ALTER TABLE "tag" ALTER COLUMN "createdById" SET NOT NULL;

ALTER TABLE "tag"
ADD CONSTRAINT "tag_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tag_createdById_idx" ON "tag"("createdById");
