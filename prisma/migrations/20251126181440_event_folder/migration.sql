-- AlterTable
ALTER TABLE "account" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "emittedTicket" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "folderId" UUID,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventCategory" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventXOrganizer" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "feature" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "location" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketGroup" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketType" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketXOrganizer" ALTER COLUMN "code" SET DEFAULT upper(substr(md5(random()::text), 1, 6)),
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "code" SET DEFAULT upper(substr(md5(random()::text), 1, 6));

-- CreateTable
CREATE TABLE "eventFolder" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventFolder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "eventFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
