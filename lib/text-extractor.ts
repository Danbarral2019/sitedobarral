/**
 * Extração de texto de documentos
 *
 * Suporte atual:
 * ✅ PDF - Usando pdf-parse (instalado)
 * ✅ TXT - Nativo
 * ⏳ DOCX/DOC - Planejado para Fase 2 (requer mammoth)
 */

export interface TextExtractionResult {
  success: boolean;
  text: string;
  pageCount?: number;
  error?: string;
}

/**
 * Extrai texto de um arquivo PDF usando pdf-parse
 */
export async function extractTextFromPDF(fileBuffer: Buffer): Promise<TextExtractionResult> {
  try {
    // Importa pdf-parse dinamicamente
    const pdfParse = (await import('pdf-parse')).default;

    // Extrai texto do PDF
    const data = await pdfParse(fileBuffer);

    return {
      success: true,
      text: data.text,
      pageCount: data.numpages
    };

  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Erro ao extrair texto do PDF'
    };
  }
}

/**
 * Extrai texto de arquivo de texto plano
 */
export function extractTextFromTxt(fileBuffer: Buffer): TextExtractionResult {
  try {
    const text = fileBuffer.toString('utf-8');

    return {
      success: true,
      text
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Erro ao ler arquivo de texto'
    };
  }
}

/**
 * Extrai texto baseado no tipo MIME do arquivo
 */
export async function extractText(
  fileBuffer: Buffer,
  mimeType: string
): Promise<TextExtractionResult> {

  // PDF
  if (mimeType === 'application/pdf') {
    return extractTextFromPDF(fileBuffer);
  }

  // Texto plano
  if (mimeType === 'text/plain') {
    return extractTextFromTxt(fileBuffer);
  }

  // Documentos Word (.docx, .doc)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    // TODO: Implementar com 'mammoth' (será feito na Fase 2)
    return {
      success: false,
      text: '',
      error: 'Extração de documentos Word ainda não implementada. Por enquanto, use PDF ou copie o texto para a descrição.'
    };
  }

  return {
    success: false,
    text: '',
    error: `Tipo de arquivo não suportado: ${mimeType}`
  };
}

/**
 * Limpa e normaliza texto extraído
 */
export function normalizeText(text: string): string {
  return text
    // Remove múltiplos espaços
    .replace(/\s+/g, ' ')
    // Remove quebras de linha múltiplas
    .replace(/\n{3,}/g, '\n\n')
    // Normaliza caracteres especiais de artigo
    .replace(/[ºº°]/g, 'º')
    // Trim
    .trim();
}
