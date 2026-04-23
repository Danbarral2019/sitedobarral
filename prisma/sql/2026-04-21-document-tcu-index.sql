-- Índice parcial para acelerar o ramo B do UNION ALL da jurisprudência.
-- Ver: docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md
--
-- Filtragem: category='acordao' AND tcuNumeroAcordao IS NOT NULL
-- Ordenação típica: tcuDataJulgamento DESC NULLS LAST

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_tcu_acordao_idx"
  ON "Document" ("tcuDataJulgamento" DESC NULLS LAST)
  WHERE category = 'acordao' AND "tcuNumeroAcordao" IS NOT NULL;
