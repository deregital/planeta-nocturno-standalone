-- El código de invitación pasa a ser único por evento.
-- La clave primaria ("eventId", "code") ya lo garantiza.
DROP INDEX IF EXISTS "ticketXOrganizer_code_key";
