/**
 * Text Chunker para Busca Semantica
 *
 * Divide textos longos em chunks menores com overlap
 * Otimizado para documentos juridicos (artigos, paragrafos, incisos)
 */

// ===========================
// Types
// ===========================

export interface TextChunk {
  index: number;      // Posicao do chunk (0, 1, 2...)
  content: string;    // Conteudo do chunk
  charStart: number;  // Posicao inicial no texto original
  charEnd: number;    // Posicao final no texto original
  tokenEstimate: number; // Estimativa de tokens (~4 chars = 1 token)
}

export interface ChunkOptions {
  maxChunkSize?: number;  // Tamanho maximo em caracteres (default: 1000)
  overlapSize?: number;   // Sobreposicao entre chunks (default: 200)
  minChunkSize?: number;  // Tamanho minimo para criar chunk (default: 100)
  preserveParagraphs?: boolean; // Tentar preservar paragrafos (default: true)
  preserveSentences?: boolean;  // Tentar preservar sentencas (default: true)
}

// ===========================
// Default Configuration
// ===========================

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChunkSize: 1000,    // ~250 tokens
  overlapSize: 200,      // ~50 tokens de overlap
  minChunkSize: 100,     // Minimo de 100 chars
  preserveParagraphs: true,
  preserveSentences: true,
};

// ===========================
// Main Chunking Function
// ===========================

/**
 * Divide texto em chunks com overlap
 *
 * Estrategia:
 * 1. Tenta dividir em paragrafos primeiro
 * 2. Se paragrafo muito grande, divide em sentencas
 * 3. Se ainda grande, divide por tamanho fixo com overlap
 *
 * @param text - Texto completo para dividir
 * @param options - Opcoes de chunking
 * @returns Array de chunks
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normaliza o texto
  const normalizedText = normalizeText(text);

  if (normalizedText.length <= opts.maxChunkSize) {
    // Texto pequeno: retorna como chunk unico
    return [{
      index: 0,
      content: normalizedText,
      charStart: 0,
      charEnd: normalizedText.length,
      tokenEstimate: estimateTokens(normalizedText),
    }];
  }

  // Divide em paragrafos primeiro
  const paragraphs = splitIntoParagraphs(normalizedText);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentStart = 0;
  let charPosition = 0;

  for (const paragraph of paragraphs) {
    const paragraphWithNewline = paragraph + '\n\n';

    // Se adicionar o paragrafo excede o limite
    if (currentChunk.length + paragraphWithNewline.length > opts.maxChunkSize) {
      // Salva chunk atual se grande o suficiente
      if (currentChunk.length >= opts.minChunkSize) {
        chunks.push(createChunk(
          chunks.length,
          currentChunk.trim(),
          currentStart,
          currentStart + currentChunk.length
        ));
      }

      // Se paragrafo sozinho excede o limite, divide-o
      if (paragraphWithNewline.length > opts.maxChunkSize) {
        const subChunks = chunkLongParagraph(
          paragraph,
          charPosition,
          opts,
          chunks.length
        );
        chunks.push(...subChunks);
        charPosition += paragraph.length + 2; // +2 para \n\n
        currentChunk = '';
        currentStart = charPosition;
      } else {
        // Inicia novo chunk com overlap
        const overlap = getOverlap(currentChunk, opts.overlapSize);
        currentChunk = overlap + paragraphWithNewline;
        currentStart = charPosition - overlap.length;
        charPosition += paragraph.length + 2;
      }
    } else {
      // Adiciona paragrafo ao chunk atual
      currentChunk += paragraphWithNewline;
      charPosition += paragraph.length + 2;
    }
  }

  // Salva ultimo chunk se existir
  if (currentChunk.trim().length >= opts.minChunkSize) {
    chunks.push(createChunk(
      chunks.length,
      currentChunk.trim(),
      currentStart,
      currentStart + currentChunk.length
    ));
  }

  return chunks;
}

// ===========================
// Helper Functions
// ===========================

/**
 * Divide um paragrafo longo em chunks menores
 */
function chunkLongParagraph(
  paragraph: string,
  startPosition: number,
  opts: Required<ChunkOptions>,
  startIndex: number
): TextChunk[] {
  const chunks: TextChunk[] = [];

  if (opts.preserveSentences) {
    // Tenta dividir por sentencas
    const sentences = splitIntoSentences(paragraph);
    let currentChunk = '';
    let currentStart = startPosition;
    let sentencePosition = startPosition;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > opts.maxChunkSize) {
        if (currentChunk.length >= opts.minChunkSize) {
          chunks.push(createChunk(
            startIndex + chunks.length,
            currentChunk.trim(),
            currentStart,
            currentStart + currentChunk.length
          ));
        }

        // Overlap da ultima parte
        const overlap = getOverlap(currentChunk, opts.overlapSize);
        currentChunk = overlap + sentence;
        currentStart = sentencePosition - overlap.length;
      } else {
        currentChunk += sentence;
      }
      sentencePosition += sentence.length;
    }

    if (currentChunk.trim().length >= opts.minChunkSize) {
      chunks.push(createChunk(
        startIndex + chunks.length,
        currentChunk.trim(),
        currentStart,
        currentStart + currentChunk.length
      ));
    }

    if (chunks.length > 0) {
      return chunks;
    }
  }

  // Fallback: divide por tamanho fixo
  return chunkBySize(paragraph, startPosition, opts, startIndex);
}

/**
 * Divide texto por tamanho fixo com overlap
 */
function chunkBySize(
  text: string,
  startPosition: number,
  opts: Required<ChunkOptions>,
  startIndex: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let position = 0;

  while (position < text.length) {
    const end = Math.min(position + opts.maxChunkSize, text.length);
    const content = text.slice(position, end);

    chunks.push(createChunk(
      startIndex + chunks.length,
      content,
      startPosition + position,
      startPosition + end
    ));

    // Avanca com overlap
    position += opts.maxChunkSize - opts.overlapSize;

    // Evita loop infinito
    if (position >= text.length - opts.minChunkSize) {
      break;
    }
  }

  return chunks;
}

/**
 * Cria objeto TextChunk
 */
function createChunk(
  index: number,
  content: string,
  charStart: number,
  charEnd: number
): TextChunk {
  return {
    index,
    content,
    charStart,
    charEnd,
    tokenEstimate: estimateTokens(content),
  };
}

/**
 * Normaliza texto para processamento
 */
function normalizeText(text: string): string {
  return text
    // Normaliza quebras de linha
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiplas quebras de linha (max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove espacos em excesso
    .replace(/[ \t]+/g, ' ')
    // Remove espacos no inicio/fim de linhas
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    // Normaliza caracteres de artigo/paragrafo juridico
    .replace(/[ºº°]/g, 'º')
    .replace(/§§/g, '§')
    // Remove caracteres de controle
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * Divide texto em paragrafos
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Divide texto em sentencas
 * Lida com abreviacoes comuns em textos juridicos
 */
function splitIntoSentences(text: string): string[] {
  // Protege abreviacoes comuns
  const protected_text = text
    .replace(/Art\./g, 'Art\u0000')
    .replace(/art\./g, 'art\u0000')
    .replace(/Inc\./g, 'Inc\u0000')
    .replace(/§\s*(\d+)/g, '§\u0000$1')
    .replace(/n[ºo]\./gi, 'nº\u0000')
    .replace(/Dr\./g, 'Dr\u0000')
    .replace(/Dra\./g, 'Dra\u0000')
    .replace(/Sr\./g, 'Sr\u0000')
    .replace(/Sra\./g, 'Sra\u0000')
    .replace(/etc\./g, 'etc\u0000')
    .replace(/p\.\s*ex\./g, 'p\u0000ex\u0000')
    .replace(/i\.e\./g, 'i\u0000e\u0000')
    .replace(/e\.g\./g, 'e\u0000g\u0000');

  // Divide por pontuacao final
  const sentences = protected_text
    .split(/([.!?]+\s+)/)
    .reduce((acc: string[], part, i, arr) => {
      if (i % 2 === 0) {
        acc.push(part + (arr[i + 1] || ''));
      }
      return acc;
    }, [])
    .map(s => s.replace(/\u0000/g, '.').trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Obtem overlap do final do texto
 */
function getOverlap(text: string, size: number): string {
  if (text.length <= size) {
    return text;
  }

  // Tenta cortar em limite de sentenca
  const overlap = text.slice(-size);
  const sentenceStart = overlap.search(/[.!?]\s+[A-Z]/);

  if (sentenceStart > 0 && sentenceStart < size / 2) {
    return overlap.slice(sentenceStart + 2);
  }

  // Fallback: corta em espaco
  const spaceIndex = overlap.indexOf(' ');
  if (spaceIndex > 0 && spaceIndex < size / 4) {
    return overlap.slice(spaceIndex + 1);
  }

  return overlap;
}

/**
 * Estima numero de tokens (~4 caracteres = 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ===========================
// Specialized Chunkers
// ===========================

/**
 * Chunker otimizado para documentos juridicos
 * Preserva estrutura de artigos, paragrafos e incisos
 */
export function chunkLegalDocument(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    maxChunkSize: options.maxChunkSize || 1200, // Um pouco maior para contexto juridico
    preserveParagraphs: true,
    preserveSentences: true,
  };

  // Pre-processa para marcar estrutura juridica
  const markedText = text
    // Marca artigos
    .replace(/\b(Art\.\s*\d+)/gi, '\n\n$1')
    // Marca paragrafos legais
    .replace(/(§\s*\d+[ºo]?)/gi, '\n$1')
    // Marca incisos
    .replace(/\n([IVXLCDM]+\s*[-–])/g, '\n$1')
    .replace(/\n(\d+\s*[-–])/g, '\n$1');

  return chunkText(markedText, opts);
}

/**
 * Chunker para acordaos do TCU
 * Preserva estrutura de ementa, relatorio e voto
 */
export function chunkTCUDocument(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    maxChunkSize: options.maxChunkSize || 1500, // Maior para contexto de acordaos
  };

  // Marca secoes principais do acordao
  const markedText = text
    .replace(/(EMENTA|RELAT[ÓO]RIO|VOTO|AC[ÓO]RD[ÃA]O)\s*:/gi, '\n\n## $1:\n')
    .replace(/(VISTOS|RELATADOS|DISCUTIDOS)/gi, '\n$1');

  return chunkText(markedText, opts);
}

// ===========================
// Export
// ===========================

export default {
  chunkText,
  chunkLegalDocument,
  chunkTCUDocument,
  normalizeText,
  estimateTokens,
  DEFAULT_OPTIONS,
};
