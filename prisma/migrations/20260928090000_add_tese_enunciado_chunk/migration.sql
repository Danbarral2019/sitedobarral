-- CreateTable
CREATE TABLE "TeseEnunciadoChunk" (
    "id" TEXT NOT NULL,
    "enunciadoId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeseEnunciadoChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeseEnunciadoChunk_enunciadoId_key" ON "TeseEnunciadoChunk"("enunciadoId");

-- AddForeignKey
ALTER TABLE "TeseEnunciadoChunk" ADD CONSTRAINT "TeseEnunciadoChunk_enunciadoId_fkey" FOREIGN KEY ("enunciadoId") REFERENCES "TeseEnunciado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

