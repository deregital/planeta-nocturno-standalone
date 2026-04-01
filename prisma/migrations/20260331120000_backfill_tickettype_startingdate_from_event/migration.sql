-- Backfill: reemplazar startingDate de ticketType con el startingDate del evento.
UPDATE "ticketType" tt
SET "startingDate" = e."startingDate"
FROM "event" e
WHERE tt."eventId" = e.id;

-- Eliminar el default para que inserciones futuras sin startingDate explícito fallen.
ALTER TABLE "ticketType" ALTER COLUMN "startingDate" DROP DEFAULT;
