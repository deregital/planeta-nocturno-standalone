-- Postgres no indexa las foreign keys automáticamente. Sin estos índices, las
-- relaciones de Drizzle (lateral joins por fila) y los ON DELETE CASCADE /
-- SET NULL recorren la tabla completa por cada fila relacionada.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticketGroup_event_id_idx" ON "ticketGroup"("event_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticketGroup_invitedById_idx" ON "ticketGroup"("invitedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticketGroupAnswer_questionId_idx" ON "ticketGroupAnswer"("questionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticketGroupAnswer_ticketGroupId_idx" ON "ticketGroupAnswer"("ticketGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticketTypePerGroup_ticketGroupId_idx" ON "ticketTypePerGroup"("ticketGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "emittedTicket_ticketTypeId_idx" ON "emittedTicket"("ticketTypeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "emittedTicket_ticketGroupId_idx" ON "emittedTicket"("ticketGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "emittedTicket_dni_createdAt_idx" ON "emittedTicket"("dni", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eventQuestion_eventId_idx" ON "eventQuestion"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticketXOrganizer_ticketGroupId_idx" ON "ticketXOrganizer"("ticketGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eventXOrganizer_organizerId_idx" ON "eventXOrganizer"("organizerId");
