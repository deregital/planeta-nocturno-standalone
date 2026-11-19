-- Bloquear un evento: nadie del público entra, ni por link ni por invitación.
-- Es independiente de isActive (visible en la ticketera).
ALTER TABLE "event" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
