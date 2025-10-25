/*
  Warnings:

  - You are about to drop the column `invitedBy` on the `ticketGroup` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[dni]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Made the column `eventId` on table `emittedTicket` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `birthDate` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dni` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phoneNumber` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InviteCondition" AS ENUM ('TRADITIONAL', 'INVITATION');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ORGANIZER';

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "emittedTicket" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "eventId" SET NOT NULL,
ALTER COLUMN "slug" DROP DEFAULT;

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "inviteCondition" "InviteCondition" NOT NULL DEFAULT 'TRADITIONAL',
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventCategory" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "feature" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "location" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketGroup" DROP COLUMN "invitedBy",
ADD COLUMN     "invitedById" UUID,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketType" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "birthDate" TEXT NOT NULL,
ADD COLUMN     "code" TEXT NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 6)),
ADD COLUMN     "dni" TEXT NOT NULL,
ADD COLUMN     "gender" TEXT NOT NULL,
ADD COLUMN     "phoneNumber" TEXT NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketXOrganizer" (
    "ticketId" UUID,
    "organizerId" UUID NOT NULL,
    "ticketGroupId" UUID,
    "code" TEXT NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 6)),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "eventXOrganizer" (
    "eventId" UUID NOT NULL,
    "organizerId" UUID NOT NULL,
    "discountPercentage" INTEGER,
    "ticketAmount" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventXOrganizer_pkey" PRIMARY KEY ("eventId","organizerId")
);

-- CreateTable
CREATE TABLE "_USER_X_TAG" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_USER_X_TAG_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticketXOrganizer_ticketId_key" ON "ticketXOrganizer"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "ticketXOrganizer_code_key" ON "ticketXOrganizer"("code");

-- CreateIndex
CREATE INDEX "ticketXOrganizer_ticketId_idx" ON "ticketXOrganizer"("ticketId");

-- CreateIndex
CREATE INDEX "ticketXOrganizer_organizerId_idx" ON "ticketXOrganizer"("organizerId");

-- CreateIndex
CREATE INDEX "ticketXOrganizer_code_idx" ON "ticketXOrganizer"("code");

-- CreateIndex
CREATE INDEX "_USER_X_TAG_B_index" ON "_USER_X_TAG"("B");

-- CreateIndex
CREATE UNIQUE INDEX "user_dni_key" ON "user"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "user_code_key" ON "user"("code");

-- CreateIndex
CREATE INDEX "user_code_idx" ON "user"("code");

-- AddForeignKey
ALTER TABLE "ticketGroup" ADD CONSTRAINT "ticketGroup_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emittedTicket" ADD CONSTRAINT "emittedTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "emittedTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketXOrganizer" ADD CONSTRAINT "ticketXOrganizer_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "ticketGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventXOrganizer" ADD CONSTRAINT "eventXOrganizer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventXOrganizer" ADD CONSTRAINT "eventXOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_USER_X_TAG" ADD CONSTRAINT "_USER_X_TAG_A_fkey" FOREIGN KEY ("A") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_USER_X_TAG" ADD CONSTRAINT "_USER_X_TAG_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
