import { apiLogger } from "@/lib/logger";

/**
 * Extracao de texto de documentos
 *
 * Suporte:
 * - PDF - pdf-parse
 * - DOCX - mammoth
 * - TXT - Nativo
 * - Fallback OCR - Gemini Vision (para PDFs escaneados)
 */

// ===========================
// Types
// ===========================

export interface TextExtractionResult {
  success: boolean;
  text: string;
  pageCount?: number;
  error?: string;
  method?: 'pdf-parse' | 'mammoth' | 'native' | 'gemini-vision';
}

// ===========================
// PDF Extraction
// ===========================

/**
 * Extrai texto de um arquivo PDF usando pdf-parse
 */
export async function extractTextFromPDF(fileBuffer: Buffer): Promise<TextExtractionResult> {
  try {
    // Importa pdf-parse v2 dinamicamente
    const { PDFParse } = await import('pdf-parse');

    // Extrai texto do PDF usando a nova API v2
    const parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();

    return {
      success: true,
      text: result.text || '',
      pageCount: (result as unknown as { numPages?: number }).numPages,
      method: 'pdf-parse',
    };

  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao extrair texto do PDF:');
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Erro ao extrair texto do PDF',
    };
  }
}

// ===========================
// DOCX Extraction
// ===========================

/**
 * Extrai texto de um arquivo DOCX usando mammoth
 */
export async function extractTextFromDOCX(fileBuffer: Buffer): Promise<TextExtractionResult> {
  try {
    // Importa mammoth dinamicamente
    const mammoth = await import('mammoth');

    // Extrai texto do DOCX
    const result = await mammoth.extractRawText({ buffer: fileBuffer });

    return {
      success: true,
      text: result.value,
      method: 'mammoth',
    };

  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao extrair texto do DOCX:');
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Erro ao extrair texto do DOCX',
    };
  }
}

/**
 * Extrai texto com formatacao HTML de um arquivo DOCX
 * Util para preservar estrutura de titulos, listas, etc.
 */
export async function extractHtmlFromDOCX(fileBuffer: Buffer): Promise<{ html: string; text: string; messages: string[] }> {
  const mammoth = await import('mammoth');

  const htmlResult = await mammoth.convertToHtml({ buffer: fileBuffer });
  const textResult = await mammoth.extractRawText({ buffer: fileBuffer });

  return {
    html: htmlResult.value,
    text: textResult.value,
    messages: htmlResult.messages.map(m => m.message),
  };
}

// ===========================
// TXT Extraction
// ===========================

/**
 * Extrai texto de arquivo de texto plano
 */
export function extractTextFromTxt(fileBuffer: Buffer): TextExtractionResult {
  try {
    const text = fileBuffer.toString('utf-8');

    return {
      success: true,
      text,
      method: 'native',
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Erro ao ler arquivo de texto',
    };
  }
}

// ===========================
// OCR via Gemini Vision
// ===========================

/**
 * Extrai texto de PDF escaneado usando Gemini Vision (OCR)
 * Usado como fallback quando pdf-parse retorna pouco texto
 */
export async function extractTextWithGeminiVision(fileBuffer: Buffer): Promise<TextExtractionResult> {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const { PRIMARY_GEMINI_MODEL } = await import('@/lib/gemini/config');
    const { withGeminiKeyFallback } = await import('@/lib/gemini/api-key-fallback');

    // Converte buffer para base64
    const base64 = fileBuffer.toString('base64');

    // OCR é multimodal (PDF via inlineData), então não pode passar pelo gateway
    // text-only `generate()`. Usamos o SDK direto, mas dentro de
    // withGeminiKeyFallback para herdar o fallback primária→backup em quota
    // (429/RESOURCE_EXHAUSTED) da PR #128. Se nenhuma key estiver configurada,
    // o wrapper lança e o catch abaixo converte para um resultado de falha.
    const result = await withGeminiKeyFallback((apiKey) => {
      const genAI = new GoogleGenAI({ apiKey });
      return genAI.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64,
            },
          },
          {
            text: `Extraia todo o texto deste documento PDF escaneado.
               Mantenha a formatacao original (paragrafos, listas, numeracao).
               Preserve a estrutura de artigos, paragrafos e incisos se for documento juridico.
               Retorne apenas o texto extraido, sem comentarios adicionais.`,
          },
        ],
      });
    });

    const text = result.text ?? '';

    return {
      success: true,
      text,
      method: 'gemini-vision',
    };

  } catch (error) {
    apiLogger.error({ err: error }, 'Erro no OCR via Gemini Vision:');
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : 'Erro no OCR via Gemini Vision',
    };
  }
}

// ===========================
// Main Extraction Function
// ===========================

/**
 * Extrai texto baseado no tipo MIME do arquivo
 * Inclui fallback automatico para OCR em PDFs escaneados
 */
export async function extractText(
  fileBuffer: Buffer,
  mimeType: string
): Promise<TextExtractionResult> {

  // PDF
  if (mimeType === 'application/pdf') {
    const result = await extractTextFromPDF(fileBuffer);

    // Se texto muito curto, pode ser PDF escaneado - tenta OCR
    if (result.success && result.text.length < 100) {
      console.log(`📸 PDF text too short (${result.text.length} chars), trying Gemini Vision OCR...`);
      const ocrResult = await extractTextWithGeminiVision(fileBuffer);

      if (ocrResult.success && ocrResult.text.length > result.text.length) {
        return ocrResult;
      }
    }

    return result;
  }

  // Texto plano
  if (mimeType === 'text/plain') {
    return extractTextFromTxt(fileBuffer);
  }

  // Documentos Word (.docx)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDOCX(fileBuffer);
  }

  // Documentos Word antigos (.doc)
  if (mimeType === 'application/msword') {
    // mammoth nao suporta .doc diretamente
    // Retorna erro informativo
    return {
      success: false,
      text: '',
      error: 'Formato .doc nao suportado diretamente. Converta para .docx ou PDF.',
    };
  }

  return {
    success: false,
    text: '',
    error: `Tipo de arquivo nao suportado: ${mimeType}`,
  };
}

// ===========================
// Text Normalization
// ===========================

/**
 * Limpa e normaliza texto extraido
 * Otimizado para documentos juridicos
 */
export function normalizeText(text: string): string {
  return text
    // Normaliza quebras de linha
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiplas quebras de linha (max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove multiplos espacos
    .replace(/[ \t]+/g, ' ')
    // Remove espacos no inicio/fim de linhas
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    // Normaliza caracteres especiais de artigo
    .replace(/[ºº°]/g, 'º')
    // Normaliza paragrafos juridicos
    .replace(/§§/g, '§')
    // Remove caracteres de controle (exceto newline)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Remove BOM
    .replace(/^\uFEFF/, '')
    // Trim final
    .trim();
}

/**
 * Remove cabecalhos e rodapes repetitivos de PDFs
 */
export function removeHeadersFooters(text: string): string {
  const lines = text.split('\n');

  // Detecta padroes de cabecalho/rodape (aparecem em multiplas paginas)
  const lineCount = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 100) {
      lineCount.set(trimmed, (lineCount.get(trimmed) || 0) + 1);
    }
  }

  // Remove linhas que aparecem mais de 3 vezes (provavelmente cabecalho/rodape)
  const repeatedLines = new Set<string>();
  for (const [line, count] of lineCount) {
    if (count > 3) {
      repeatedLines.add(line);
    }
  }

  if (repeatedLines.size === 0) {
    return text;
  }

  return lines
    .filter(line => !repeatedLines.has(line.trim()))
    .join('\n');
}

/**
 * Extrai apenas o corpo principal do texto (remove sumario, indice, etc.)
 */
export function extractMainContent(text: string): string {
  // Remove padroes comuns de sumario/indice
  const patterns = [
    /^SUMÁRIO[\s\S]*?(?=\n[A-Z]{2,}|\n\d+\.)/im,
    /^ÍNDICE[\s\S]*?(?=\n[A-Z]{2,}|\n\d+\.)/im,
    /^CONTEÚDO[\s\S]*?(?=\n[A-Z]{2,}|\n\d+\.)/im,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }

  return result.trim();
}

// ===========================
// Export
// ===========================

const textExtractor = {
  extractText,
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromTxt,
  extractHtmlFromDOCX,
  extractTextWithGeminiVision,
  normalizeText,
  removeHeadersFooters,
  extractMainContent,
};
export default textExtractor;
