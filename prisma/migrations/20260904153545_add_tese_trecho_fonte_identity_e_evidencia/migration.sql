-- AlterTable
ALTER TABLE "TeseDestilacao" ADD COLUMN     "acordaoKey" TEXT,
ADD COLUMN     "colegiadoAlvo" TEXT,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "relatorAlvo" TEXT,
ADD COLUMN     "urlAlvo" TEXT;

-- AlterTable
ALTER TABLE "TeseEnunciado" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "embeddingStatus" TEXT,
ADD COLUMN     "publicado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retiradoEm" TIMESTAMP(3),
ADD COLUMN     "retiradoMotivo" TEXT,
ADD COLUMN     "vitrinePublica" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TeseTrechoFonte" (
    "id" TEXT NOT NULL,
    "enunciadoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "trecho" TEXT NOT NULL,
    "origemNumero" INTEGER NOT NULL,
    "origemAno" INTEGER NOT NULL,
    "origemColegiado" TEXT,
    "origemUrl" TEXT,
    "origemLinkPDF" TEXT,
    "origemDocumentId" TEXT,
    "noVoto" BOOLEAN NOT NULL,
    "capturadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeseTrechoFonte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeseTrechoFonte_enunciadoId_idx" ON "TeseTrechoFonte"("enunciadoId");

-- CreateIndex
CREATE INDEX "TeseTrechoFonte_origemDocumentId_idx" ON "TeseTrechoFonte"("origemDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeseTrechoFonte_enunciadoId_ordem_key" ON "TeseTrechoFonte"("enunciadoId", "ordem");

-- CreateIndex
CREATE INDEX "TeseDestilacao_acordaoKey_idx" ON "TeseDestilacao"("acordaoKey");

-- CreateIndex
CREATE INDEX "TeseDestilacao_documentId_idx" ON "TeseDestilacao"("documentId");

-- CreateIndex
CREATE INDEX "TeseEnunciado_publicado_idx" ON "TeseEnunciado"("publicado");

-- CreateIndex
CREATE INDEX "TeseEnunciado_vitrinePublica_idx" ON "TeseEnunciado"("vitrinePublica");

-- CreateIndex
CREATE INDEX "TeseEnunciado_embeddingStatus_idx" ON "TeseEnunciado"("embeddingStatus");

-- AddForeignKey
ALTER TABLE "TeseDestilacao" ADD CONSTRAINT "TeseDestilacao_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeseTrechoFonte" ADD CONSTRAINT "TeseTrechoFonte_enunciadoId_fkey" FOREIGN KEY ("enunciadoId") REFERENCES "TeseEnunciado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeseTrechoFonte" ADD CONSTRAINT "TeseTrechoFonte_origemDocumentId_fkey" FOREIGN KEY ("origemDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
