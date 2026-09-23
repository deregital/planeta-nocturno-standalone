-- AlterTable
ALTER TABLE "event" ALTER COLUMN "startingDate" DROP NOT NULL;
ALTER TABLE "event" ALTER COLUMN "endingDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ticketType" ALTER COLUMN "startingDate" DROP NOT NULL;
