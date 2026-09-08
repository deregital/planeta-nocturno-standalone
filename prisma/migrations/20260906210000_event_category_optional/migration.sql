-- Make event.categoryId optional and clear it if the category is deleted.
ALTER TABLE "event" DROP CONSTRAINT "event_categoryId_fkey";

ALTER TABLE "event" ALTER COLUMN "categoryId" DROP NOT NULL;

ALTER TABLE "event" ADD CONSTRAINT "event_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "eventCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
