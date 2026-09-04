-- CreateTable
CREATE TABLE "AlvoIdentidadeIrresolvida" (
    "id" TEXT NOT NULL,
    "numeroAlvo" INTEGER NOT NULL,
    "anoAlvo" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "candidatos" INTEGER,
    "verificadoEm" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AlvoIdentidadeIrresolvida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlvoIdentidadeIrresolvida_chave_idx" ON "AlvoIdentidadeIrresolvida"("chave");

-- CreateIndex
CREATE INDEX "AlvoIdentidadeIrresolvida_verificadoEm_idx" ON "AlvoIdentidadeIrresolvida"("verificadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "AlvoIdentidadeIrresolvida_numeroAlvo_anoAlvo_key" ON "AlvoIdentidadeIrresolvida"("numeroAlvo", "anoAlvo");
