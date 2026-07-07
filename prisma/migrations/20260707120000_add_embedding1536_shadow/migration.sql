-- Shadow A/B Fase 4.1: colunas nullable embedding1536 (vector(1536)) nas 3 tabelas de chunk.
-- Aditivo apenas — nenhum NOT NULL, nenhum índice, nenhuma alteração destrutiva.
ALTER TABLE "DocumentChunk" ADD COLUMN "embedding1536" vector(1536);
ALTER TABLE "LegislativeActChunk" ADD COLUMN "embedding1536" vector(1536);
ALTER TABLE "TribunalDecisionChunk" ADD COLUMN "embedding1536" vector(1536);
