/**
 * Parser de Enunciados de PDFs (IBDA, INCP, etc.)
 *
 * Extrai enunciados individuais de arquivos PDF que seguem o padrão:
 * - "ENUNCIADO 1", "ENUNCIADO 2", etc.
 * - Cada enunciado contém texto completo até o próximo enunciado
 */

import * as pdfParse from 'pdf-parse';

export interface Enunciado {
  numero: number;
  titulo: string; // "ENUNCIADO 1", "ENUNCIADO 2", etc.
  texto: string; // Conteúdo completo do enunciado
  fonte: string; // Nome do arquivo PDF original
  metadados?: {
    numeroPropostaPublica?: string; // Ex: "265 (GT 1 – art. 2º e 3º)"
    artigos?: string[]; // Artigos da lei mencionados
    keywords?: string[]; // Palavras-chave extraídas
  };
}

export interface ParseResult {
  success: boolean;
  fonte: string;
  totalEnunciados: number;
  enunciados: Enunciado[];
  error?: string;
}

/**
 * Extrai todos os enunciados de um buffer PDF
 */
export async function parseEnunciadosPDF(
  pdfBuffer: Buffer,
  nomeArquivo: string
): Promise<ParseResult> {
  try {
    console.log(`[Enunciados Parser] Processando: ${nomeArquivo}`);

    // Parse do PDF
    const data = await pdfParse(pdfBuffer);
    const textoCompleto = data.text;

    console.log(`[Enunciados Parser] PDF possui ${data.numpages} páginas, ${textoCompleto.length} caracteres`);

    // Divide o texto em enunciados usando regex
    // Padrão: "ENUNCIADO" seguido de número (1, 2, 3, etc.)
    const regex = /ENUNCIADO\s+(\d+)[.\s]*/gi;
    const matches = Array.from(textoCompleto.matchAll(regex));

    if (matches.length === 0) {
      return {
        success: false,
        fonte: nomeArquivo,
        totalEnunciados: 0,
        enunciados: [],
        error: 'Nenhum enunciado encontrado no PDF. Certifique-se de que o formato seja "ENUNCIADO 1", "ENUNCIADO 2", etc.',
      };
    }

    console.log(`[Enunciados Parser] Encontrados ${matches.length} enunciados`);

    // Extrai cada enunciado
    const enunciados: Enunciado[] = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const numero = parseInt(match[1]);
      const startIndex = match.index! + match[0].length;

      // Texto vai até o próximo "ENUNCIADO" ou fim do documento
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : textoCompleto.length;

      let texto = textoCompleto.substring(startIndex, endIndex).trim();

      // Limpa texto
      texto = cleanText(texto);

      // Extrai metadados
      const metadados = extractMetadados(texto);

      // Gera título
      const titulo = `ENUNCIADO ${numero}`;

      enunciados.push({
        numero,
        titulo,
        texto,
        fonte: nomeArquivo,
        metadados,
      });

      console.log(`[Enunciados Parser] Enunciado ${numero}: ${texto.substring(0, 100)}...`);
    }

    return {
      success: true,
      fonte: nomeArquivo,
      totalEnunciados: enunciados.length,
      enunciados,
    };

  } catch (error) {
    console.error('[Enunciados Parser] Erro:', error);
    return {
      success: false,
      fonte: nomeArquivo,
      totalEnunciados: 0,
      enunciados: [],
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF',
    };
  }
}

/**
 * Limpa e normaliza o texto do enunciado
 */
function cleanText(texto: string): string {
  // Remove quebras de linha excessivas
  texto = texto.replace(/\n{3,}/g, '\n\n');

  // Remove espaços múltiplos
  texto = texto.replace(/\s{2,}/g, ' ');

  // Remove caracteres de controle
  texto = texto.replace(/[\x00-\x1F\x7F]/g, '');

  return texto.trim();
}

/**
 * Extrai metadados do texto do enunciado
 */
function extractMetadados(texto: string): Enunciado['metadados'] {
  const metadados: Enunciado['metadados'] = {};

  // Extrai "Número da proposta apresentada pelo público"
  const propostaMatch = texto.match(/Número da proposta.*?:\s*(\d+.*?)(?:\n|$)/i);
  if (propostaMatch) {
    metadados.numeroPropostaPublica = propostaMatch[1].trim();
  }

  // Extrai artigos mencionados (art. X, artigo X, arts. X e Y)
  const artigosMatches = texto.matchAll(/art(?:igo)?s?\.?\s*(\d+(?:º)?(?:\s*[,eaou]+\s*\d+(?:º)?)*)/gi);
  const artigos = new Set<string>();
  for (const match of artigosMatches) {
    // Normaliza "art. 2º e 3º" → ["2", "3"]
    const nums = match[1].match(/\d+/g);
    if (nums) {
      nums.forEach(n => artigos.add(n));
    }
  }
  if (artigos.size > 0) {
    metadados.artigos = Array.from(artigos);
  }

  // Extrai keywords básicas (palavras importantes em maiúsculas ou termos técnicos)
  const keywords = new Set<string>();
  const keywordPatterns = [
    /Lei n\.?\s*14\.133\/202\d/gi,
    /Administração Pública/gi,
    /contrato[s]?\s+administrativo[s]?/gi,
    /licitaç(?:ão|ões)/gi,
    /pregão/gi,
    /registro de preços/gi,
    /economicidade/gi,
  ];

  keywordPatterns.forEach(pattern => {
    const matches = texto.matchAll(pattern);
    for (const match of matches) {
      keywords.add(match[0].toLowerCase());
    }
  });

  if (keywords.size > 0) {
    metadados.keywords = Array.from(keywords);
  }

  return metadados;
}

/**
 * Classifica enunciados usando a mesma IA do TCU
 * (reutiliza lib/tcu-classifier.ts com adaptações)
 */
export async function classifyEnunciado(
  enunciado: Enunciado
): Promise<{
  success: boolean;
  titulo: string;
  descricao: string;
  categoria: string;
  cursos: string[];
  tags: string[];
  confianca: number;
  raciocinio: string;
  error?: string;
}> {
  // Importação dinâmica para evitar circular dependency
  const { classifyTCUAcordao } = await import('./tcu-classifier');

  // Adapta enunciado para o formato do classificador TCU
  const tcuInput = {
    planilha: {
      enunciado: enunciado.texto,
      area: 'Direito Administrativo',
      tema: 'Licitações e Contratos',
      subtema: 'Lei 14.133/2021',
      data: '',
      acordao: enunciado.titulo,
      autorTese: enunciado.fonte,
      legislacao: enunciado.metadados?.artigos?.map(a => `art. ${a}`).join(', ') || 'Lei 14.133/2021',
      outrosIndexadores: enunciado.metadados?.keywords?.join(', ') || '',
      tipoProcesso: 'Enunciado',
    },
  };

  try {
    const result = await classifyTCUAcordao(tcuInput);

    return {
      success: result.success,
      titulo: result.titulo || `${enunciado.fonte} - ${enunciado.titulo}`,
      descricao: result.descricao || enunciado.texto.substring(0, 300),
      categoria: 'apostila', // Enunciados são material de estudo
      cursos: result.cursos || [],
      tags: result.tags || [],
      confianca: result.confianca,
      raciocinio: result.raciocinio,
      error: result.error,
    };
  } catch (error) {
    console.error('[Enunciados Classifier] Erro:', error);
    return {
      success: false,
      titulo: `${enunciado.fonte} - ${enunciado.titulo}`,
      descricao: enunciado.texto.substring(0, 300),
      categoria: 'apostila',
      cursos: ['1'], // Default: Nova Lei de Licitações
      tags: ['enunciado', 'lei-14133'],
      confianca: 50,
      raciocinio: 'Classificação por padrão (erro na IA)',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
