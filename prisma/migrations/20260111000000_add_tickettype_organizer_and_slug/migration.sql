-- AlterTable: Agregar columna slug como nullable primero
ALTER TABLE "ticketType" ADD COLUMN "slug" TEXT;

-- Generar slugs para ticketTypes existentes basados en el nombre
-- Usamos una aproximación de generateSlug: lowercase, reemplazar acentos, reemplazar espacios con guiones
-- Nota: PostgreSQL no tiene normalize('NFD'), así que usamos TRANSLATE para los acentos más comunes
UPDATE "ticketType" 
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(
        "name",
        'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿŸ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOoooooUUUUuuuuCcNnYyyY'
      ),
      '[^a-z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE "slug" IS NULL;

-- Asegurar que no haya slugs duplicados por evento agregando un sufijo numérico si es necesario
-- Primero, crear slugs únicos para cada ticketType dentro de su evento
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER;
BEGIN
  FOR rec IN SELECT id, "eventId", "name" FROM "ticketType" ORDER BY id LOOP
    base_slug := LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          TRANSLATE(
            rec.name,
            'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿŸ',
            'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOoooooUUUUuuuuCcNnYyyY'
          ),
          '[^a-z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      )
    );
    
    final_slug := base_slug;
    counter := 1;
    
    -- Verificar si el slug ya existe para este evento
    WHILE EXISTS (
      SELECT 1 FROM "ticketType" 
      WHERE "eventId" = rec."eventId" 
      AND "slug" = final_slug 
      AND id != rec.id
    ) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    UPDATE "ticketType" SET "slug" = final_slug WHERE id = rec.id;
  END LOOP;
END $$;

-- Hacer la columna slug NOT NULL
ALTER TABLE "ticketType" ALTER COLUMN "slug" SET NOT NULL;

-- Agregar columna organizerId (nullable)
ALTER TABLE "ticketType" ADD COLUMN "organizerId" UUID;

-- Agregar foreign key para organizerId
ALTER TABLE "ticketType" ADD CONSTRAINT "ticketType_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Agregar índice único para [eventId, slug]
CREATE UNIQUE INDEX "ticketType_eventId_slug_key" ON "ticketType"("eventId", "slug");
