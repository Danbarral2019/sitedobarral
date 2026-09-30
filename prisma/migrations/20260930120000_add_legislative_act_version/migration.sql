-- CreateTable
CREATE TABLE "LegislativeActVersion" (
    "id" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT,
    "textSince" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "LegislativeActVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegislativeActVersion_actId_replacedAt_idx" ON "LegislativeActVersion"("actId", "replacedAt");

-- AddForeignKey
ALTER TABLE "LegislativeActVersion" ADD CONSTRAINT "LegislativeActVersion_actId_fkey" FOREIGN KEY ("actId") REFERENCES "LegislativeAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

