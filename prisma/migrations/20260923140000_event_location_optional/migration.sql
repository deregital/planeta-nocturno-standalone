-- Make event.locationId optional and clear it if the location is deleted.
ALTER TABLE "event" DROP CONSTRAINT "event_locationId_fkey";

ALTER TABLE "event" ALTER COLUMN "locationId" DROP NOT NULL;

ALTER TABLE "event" ADD CONSTRAINT "event_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "location"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
