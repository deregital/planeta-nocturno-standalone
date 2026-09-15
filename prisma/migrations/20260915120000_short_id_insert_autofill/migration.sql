-- Tenant databases are migrated fleet-wide while each tenant instance runs its own
-- pinned application version, so a NOT NULL column has to keep working for instances
-- deployed before the column existed. "shortId" was added without a default, which made
-- every INSERT coming from an older instance fail with 23502 (not-null violation).
--
-- These BEFORE INSERT triggers assign the next per-event "shortId" when the statement
-- omits it. Rows inserted by an up-to-date instance already carry a value, so the trigger
-- is a no-op for them. The advisory lock namespaces match the application allocators
-- (src/server/utils/emittedTicketShortId.ts and src/server/utils/ticketXOrganizerInvite.ts)
-- so both paths serialize against each other.

CREATE OR REPLACE FUNCTION "emittedTicket_fill_short_id"()
RETURNS trigger AS $$
BEGIN
  IF NEW."shortId" IS NULL THEN
    PERFORM pg_advisory_xact_lock(742192, hashtext(NEW."eventId"::text));

    SELECT COALESCE(MAX("shortId"), 0) + 1
      INTO NEW."shortId"
      FROM "emittedTicket"
     WHERE "eventId" = NEW."eventId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "emittedTicket_fill_short_id" ON "emittedTicket";
CREATE TRIGGER "emittedTicket_fill_short_id"
BEFORE INSERT ON "emittedTicket"
FOR EACH ROW
EXECUTE FUNCTION "emittedTicket_fill_short_id"();

CREATE OR REPLACE FUNCTION "ticketXOrganizer_fill_short_id"()
RETURNS trigger AS $$
BEGIN
  IF NEW."shortId" IS NULL THEN
    PERFORM pg_advisory_xact_lock(742191, hashtext(NEW."eventId"::text));

    SELECT COALESCE(MAX("shortId"), 0) + 1
      INTO NEW."shortId"
      FROM "ticketXOrganizer"
     WHERE "eventId" = NEW."eventId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ticketXOrganizer_fill_short_id" ON "ticketXOrganizer";
CREATE TRIGGER "ticketXOrganizer_fill_short_id"
BEFORE INSERT ON "ticketXOrganizer"
FOR EACH ROW
EXECUTE FUNCTION "ticketXOrganizer_fill_short_id"();
