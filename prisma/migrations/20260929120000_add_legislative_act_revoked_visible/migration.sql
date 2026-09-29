-- AlterTable
ALTER TABLE "LegislativeAct" ADD COLUMN "revokedVisible" BOOLEAN NOT NULL DEFAULT false;

-- Leis revogadas pelo art. 193, II, da Lei 14.133/2021 (redação da Lei
-- Complementar nº 198, de 2023). Seguem visíveis, com aviso: ainda regem os
-- contratos da transição.
UPDATE "LegislativeAct"
SET "revoked" = true,
    "revokedVisible" = true,
    "revokedNote" = 'Revogada pela Lei nº 14.133, de 2021 (art. 193, II), em 30 de dezembro de 2023'
WHERE "fullNumber" IN ('Lei 8.666/1993', 'Lei 10.520/2002');

-- Designação de membros de comitê, revogada; sai das visões públicas.
UPDATE "LegislativeAct"
SET "revoked" = true,
    "revokedNote" = 'Revogada pela Portaria nº 14.234, de 2023'
WHERE "fullNumber" = 'Portaria SEGES 15.496/2021';
