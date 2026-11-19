-- Emisión manual cobrada o a cobrar en el lugar. La limpieza de reservas no la
-- toca: antes quedaba BOOKED sin medio de pago y se borraba a los 10 minutos.
ALTER TYPE "PaymentMethod" ADD VALUE 'ON_SITE';

-- Versión del evento: una pestaña de edición vieja no puede pisar cambios más nuevos.
ALTER TABLE "event" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Intentos fallidos de login por usuario (freno a la fuerza bruta).
CREATE TABLE "loginAttempt" (
    "username" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ,
    "lastFailedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loginAttempt_pkey" PRIMARY KEY ("username")
);
