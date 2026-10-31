-- CreateTable
CREATE TABLE "userEventListOrder" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "containerKey" TEXT NOT NULL,
    "itemKind" TEXT NOT NULL,
    "itemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "userEventListOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "userEventListOrder_identity_key" ON "userEventListOrder"("userId", "scope", "containerKey", "itemKind", "itemId");

-- CreateIndex
CREATE INDEX "userEventListOrder_userId_scope_idx" ON "userEventListOrder"("userId", "scope");

-- AddForeignKey
ALTER TABLE "userEventListOrder" ADD CONSTRAINT "userEventListOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
