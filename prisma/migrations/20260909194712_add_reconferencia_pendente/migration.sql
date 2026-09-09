-- AlterTable
ALTER TABLE "TeseEnunciado" ADD COLUMN     "reconferenciaPendente" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TeseEnunciado_reconferenciaPendente_idx" ON "TeseEnunciado"("reconferenciaPendente");
