-- Marca texto integral obtido por OCR de PDF digitalizado (lib/ai/ocr-pdf.ts).
ALTER TABLE "Document" ADD COLUMN "textoIntegralOcr" BOOLEAN NOT NULL DEFAULT false;
