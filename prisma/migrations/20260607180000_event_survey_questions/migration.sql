-- CreateTable
CREATE TABLE "eventQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticketGroupAnswer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "answer" TEXT NOT NULL,
    "questionId" UUID NOT NULL,
    "ticketGroupId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticketGroupAnswer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "eventQuestion" ADD CONSTRAINT "eventQuestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketGroupAnswer" ADD CONSTRAINT "ticketGroupAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "eventQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketGroupAnswer" ADD CONSTRAINT "ticketGroupAnswer_ticketGroupId_fkey" FOREIGN KEY ("ticketGroupId") REFERENCES "ticketGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
