-- Contadores de intentos por ventana de tiempo (rate limiting de endpoints
-- públicos, p. ej. códigos de invitación y verificación de DNI).
CREATE TABLE "rateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rateLimitBucket_windowStart_idx" ON "rateLimitBucket"("windowStart");
