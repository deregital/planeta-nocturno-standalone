-- DropForeignKey
ALTER TABLE "public"."eventXOrganizer" DROP CONSTRAINT "eventXOrganizer_organizerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ticketXOrganizer" DROP CONSTRAINT "ticketXOrganizer_organizerId_fkey";

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "emittedTicket" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "event" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventCategory" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventFolder" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

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

-- AddForeignKey
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventXOrganizer" ADD CONSTRAINT "eventXOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
