-- Marca as entradas do histórico cuja resposta foi gravada pelo servidor.
-- Só elas podem ser compartilhadas (as antigas vinham do cliente e ficam false).
-- AlterTable
ALTER TABLE "SearchHistory" ADD COLUMN     "respostaDoServidor" BOOLEAN NOT NULL DEFAULT false;
