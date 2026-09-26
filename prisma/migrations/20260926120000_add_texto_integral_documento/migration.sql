-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "textoIntegral" TEXT,
ADD COLUMN     "textoIntegralEm" TIMESTAMP(3),
ADD COLUMN     "textoIntegralFonte" TEXT,
ADD COLUMN     "textoIntegralTentativas" INTEGER NOT NULL DEFAULT 0;
