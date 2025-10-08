/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InviteCondition" AS ENUM ('TRADITIONAL', 'INVITATION');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'RRPP';

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "emittedTicket" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "inviteCondition" "InviteCondition" NOT NULL DEFAULT 'TRADITIONAL',
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "eventCategory" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "location" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketGroup" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ticketType" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "code" TEXT NOT NULL DEFAULT upper(translate(substr(md5(random()::text), 1, 6),'0123456789abcdef','ABCDEFGHIJKLMNOPQRSTUVWXYZ')),
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketXRRPP" (
    "ticketGroupId" UUID NOT NULL,
    "rrppId" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT upper(translate(substr(md5(random()::text), 1, 6),'0123456789abcdef','ABCDEFGHIJKLMNOPQRSTUVWXYZ')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticketXRRPP_pkey" PRIMARY KEY ("ticketGroupId")
);

-- CreateTable
CREATE TABLE "_USER_X_TAG" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_USER_X_TAG_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EVENT_X_RRPP" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EVENT_X_RRPP_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticketXRRPP_code_key" ON "ticketXRRPP"("code");

-- CreateIndex
CREATE INDEX "_USER_X_TAG_B_index" ON "_USER_X_TAG"("B");

-- CreateIndex
CREATE INDEX "_EVENT_X_RRPP_B_index" ON "_EVENT_X_RRPP"("B");

-- CreateIndex
CREATE UNIQUE INDEX "user_code_key" ON "user"("code");

-- CreateIndex
CREATE INDEX "user_code_idx" ON "user"("code");

-- AddForeignKey
ALTER TABLE "ticketXRRPP" ADD CONSTRAINT "ticketXRRPP_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "ticketGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketXRRPP" ADD CONSTRAINT "ticketXRRPP_rrppId_fkey" FOREIGN KEY ("rrppId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_USER_X_TAG" ADD CONSTRAINT "_USER_X_TAG_A_fkey" FOREIGN KEY ("A") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_USER_X_TAG" ADD CONSTRAINT "_USER_X_TAG_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EVENT_X_RRPP" ADD CONSTRAINT "_EVENT_X_RRPP_A_fkey" FOREIGN KEY ("A") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EVENT_X_RRPP" ADD CONSTRAINT "_EVENT_X_RRPP_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
