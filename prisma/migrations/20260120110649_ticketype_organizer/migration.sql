/*
  Warnings:

  - You are about to drop the column `organizerId` on the `ticketType` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ticketType" DROP CONSTRAINT "ticketType_organizerId_fkey";

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
ALTER TABLE "ticketType" DROP COLUMN "organizerId",
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "slug" SET DEFAULT upper(substr(md5(random()::text), 1, 6));

-- AlterTable
ALTER TABLE "ticketXOrganizer" ALTER COLUMN "code" SET DEFAULT upper(substr(md5(random()::text), 1, 6)),
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "code" SET DEFAULT upper(substr(md5(random()::text), 1, 6));

-- CreateTable
CREATE TABLE "_TICKET_TYPE_X_ORGANIZERS" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TICKET_TYPE_X_ORGANIZERS_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TICKET_TYPE_X_ORGANIZERS_B_index" ON "_TICKET_TYPE_X_ORGANIZERS"("B");

-- AddForeignKey
ALTER TABLE "_TICKET_TYPE_X_ORGANIZERS" ADD CONSTRAINT "_TICKET_TYPE_X_ORGANIZERS_A_fkey" FOREIGN KEY ("A") REFERENCES "ticketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TICKET_TYPE_X_ORGANIZERS" ADD CONSTRAINT "_TICKET_TYPE_X_ORGANIZERS_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
