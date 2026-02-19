/**
 * DOU Module - Processamento e Importação de Documentos do DOU
 *
 * Processa resultados da API Oficial do DOU (Imprensa Nacional) e importa documentos
 * relevantes para o banco de dados com versionamento automático.
 *
 * Integra com:
 * - lib/dou-api.ts (API oficial da Imprensa Nacional)
 * - lib/querido-diario.ts (API alternativa para diários municipais)
 * - lib/shared-keywords.ts (análise de relevância)
 * - lib/agu-modules/versioning.ts (versionamento automático)
 */

import type { Document, Prisma } from '@prisma/client';
import type { QueridoDiarioGazette } from './querido-diario';
import type { DOUSearchResult } from './dou-api';
import { findOrCreateWithVersioning } from './agu-modules/versioning';
import { KEYWORDS_RELEVANCIA, detectTemas, CURSOS_KEYWORDS } from './shared-keywords';
import { extractDOUInfo } from './agu-modules/helpers';

/**
 * Interface para resultado de importação
 */
export interface DOUImportResult {
  total: number;
  novos: number;
  atualizados: number;
  semMudancas: number;
  erros: number;
  detalhes: Array<{
    titulo: string;
    status: 'novo' | 'atualizado' | 'sem_mudanca' | 'erro';
    hasChanges?: boolean;
    error?: string;
  }>;
}

/**
 * Analisa relevância de uma publicação DOU
 *
 * Usa o sistema unificado de keywords (AGU + TCU + DOU)
 */
export function analyzeRelevanceDOU(
  titulo: string,
  conteudo: string
): {
  isRelevant: boolean;
  score: number;
  temas: string[];
} {
  const text = `${titulo} ${conteudo}`.toLowerCase();
  let score = 0;

  // Keywords de alta relevância (+10)
  for (const keyword of KEYWORDS_RELEVANCIA.high) {
    if (text.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

  // Keywords de média relevância (+5)
  for (const keyword of KEYWORDS_RELEVANCIA.medium) {
    if (text.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }

  // Keywords de baixa relevância (+2)
  for (const keyword of KEYWORDS_RELEVANCIA.low) {
    if (text.includes(keyword.toLowerCase())) {
      score += 2;
    }
  }

  // Keywords de exclusão (-15)
  for (const keyword of KEYWORDS_RELEVANCIA.exclude) {
    if (text.includes(keyword.toLowerCase())) {
      score -= 15;
    }
  }

  // Normalizar score (0-100)
  score = Math.max(0, Math.min(100, score));

  // Threshold: score >= 10 = relevante (moderado, similar ao AGU/TCU)
  const isRelevant = score >= 10;

  // Detectar temas
  const temas = detectTemas(text);

  return { isRelevant, score, temas };
}

/**
 * Sugere cursos baseado no conteúdo da publicação
 */
export function suggestCoursesDOU(titulo: string, conteudo: string): string[] {
  const text = `${titulo} ${conteudo}`.toLowerCase();
  const courses = new Set<string>();

  // Verificar cada curso
  for (const [courseId, keywords] of Object.entries(CURSOS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        courses.add(courseId);
        break; // Já encontrou, não precisa verificar outras keywords deste curso
      }
    }
  }

  // Se não encontrou nenhum curso, sugerir curso "1" (Nova Lei de Licitações) como padrão
  if (courses.size === 0) {
    courses.add('1');
  }

  return Array.from(courses);
}

/**
 * Detecta categoria de documento DOU baseado no conteúdo
 */
export function detectCategoryDOU(titulo: string, conteudo: string): string {
  const text = `${titulo} ${conteudo}`.toLowerCase();

  // Padrões para detectar categorias
  const patterns = [
    { category: 'portaria', keywords: ['portaria', 'port.', 'port nº'] },
    { category: 'decreto', keywords: ['decreto', 'dec.', 'dec nº'] },
    { category: 'lei', keywords: ['lei nº', 'lei federal', 'lei complementar'] },
    { category: 'instrucao-normativa', keywords: ['instrução normativa', 'in nº'] },
    { category: 'orientacao-normativa', keywords: ['orientação normativa', 'on nº'] },
    { category: 'edital', keywords: ['aviso de licitação', 'edital', 'pregão eletrônico'] },
    { category: 'parecer', keywords: ['parecer', 'parecer vinculante'] },
    { category: 'resolucao', keywords: ['resolução', 'resol.'] },
  ];

  for (const { category, keywords } of patterns) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }

  // Categoria padrão
  return 'outros';
}

/**
 * Converte Gazette do Querido Diário para formato Document do Prisma
 */
function convertGazetteToDocumentData(
  gazette: QueridoDiarioGazette,
  excerpt: { excerpt: string; highlight: string },
  relevanceScore: number,
  temas: string[],
  suggestedCourses: string[]
): Partial<Prisma.DocumentCreateInput> {
  // Título
  const title = excerpt.highlight || `Publicação DOU - ${gazette.date}`;

  // Descrição
  const description = excerpt.excerpt || 'Publicação do Diário Oficial da União';

  // URL do arquivo PDF
  const url = gazette.file_url;

  // Categoria baseada no conteúdo
  const category = detectCategoryDOU(title, description);

  // Type: sempre 'link' (URLs externas)
  const type = 'link';

  // Tags baseadas nos temas detectados
  const tags = JSON.stringify([
    'DOU',
    gazette.edition_number,
    gazette.power === 'executive' ? 'Executivo' : gazette.power === 'legislative' ? 'Legislativo' : 'Judiciário',
    ...temas,
  ]);

  // Curso sugerido (apenas o primeiro por enquanto - multi-curso será implementado depois)
  const courseId = suggestedCourses.length > 0 ? suggestedCourses[0] : null;

  // Sempre público (publicações do DOU são públicas)
  const isPublic = true;

  // Extrai informações adicionais do DOU (seção, página, edição)
  const douInfo = extractDOUInfo(`${title} ${description} ${url}`);

  // Data de publicação
  const douData = new Date(gazette.date);

  return {
    title,
    description,
    url,
    category,
    type,
    tags,
    courseId, // Primeiro curso sugerido
    isPublic,
    // Dados do DOU (flat fields for backward compat)
    douUrl: douInfo?.douUrl || url,
    douData,
    douSecao: douInfo?.douSecao || undefined,
    douPagina: douInfo?.douPagina || undefined,
    douEdicao: gazette.edition_number,
    // Satellite table (metaDou)
    metaDou: {
      create: {
        url: douInfo?.douUrl || url,
        data: douData,
        secao: douInfo?.douSecao || undefined,
        pagina: douInfo?.douPagina || undefined,
        edicao: gazette.edition_number,
      },
    },
  };
}

/**
 * Importa um documento do DOU com versionamento
 */
export async function importDOUDocument(
  gazette: QueridoDiarioGazette,
  excerpt: { excerpt: string; highlight: string }
): Promise<{
  success: boolean;
  document?: Document;
  isNew?: boolean;
  hasChanges?: boolean;
  error?: string;
}> {
  try {
    const title = excerpt.highlight || `Publicação DOU - ${gazette.date}`;
    const content = excerpt.excerpt;

    // Análise de relevância
    const { isRelevant, score, temas } = analyzeRelevanceDOU(title, content);

    if (!isRelevant) {
      return {
        success: false,
        error: `Documento não relevante (score: ${score})`,
      };
    }

    // Sugestão de cursos
    const suggestedCourses = suggestCoursesDOU(title, content);

    // Converte para formato Document
    const documentData = convertGazetteToDocumentData(
      gazette,
      excerpt,
      score,
      temas,
      suggestedCourses
    );

    // Usar o sistema de versionamento (busca por título único)
    const result = await findOrCreateWithVersioning(
      { title: documentData.title! },
      documentData,
      'scraper-dou'
    );

    return {
      success: true,
      document: result.document,
      isNew: result.isNew,
      hasChanges: result.hasChanges,
    };
  } catch (error) {
    console.error(`[DOU Module] Erro ao importar documento ${excerpt.highlight}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Importa múltiplos documentos DOU com versionamento
 *
 * Processa em lote e retorna estatísticas detalhadas
 */
export async function importDOUDocuments(
  gazettes: QueridoDiarioGazette[]
): Promise<DOUImportResult> {
  console.log(`\\n[DOU Module] Iniciando importação de ${gazettes.length} publicações DOU com versionamento...\\n`);

  const result: DOUImportResult = {
    total: 0,
    novos: 0,
    atualizados: 0,
    semMudancas: 0,
    erros: 0,
    detalhes: [],
  };

  for (let i = 0; i < gazettes.length; i++) {
    const gazette = gazettes[i];

    console.log(`[${i + 1}/${gazettes.length}] Processando ${gazette.edition_number} (${gazette.date})...`);

    // Processar cada excerpt (trecho) da publicação
    for (const excerpt of gazette.excerpts) {
      result.total++;

      const titulo = excerpt.highlight || `DOU ${gazette.edition_number} - Trecho ${result.total}`;

      const saveResult = await importDOUDocument(gazette, excerpt);

      if (saveResult.success) {
        if (saveResult.isNew) {
          console.log(`  ✅ Novo documento criado: ${titulo}`);
          result.novos++;
          result.detalhes.push({
            titulo,
            status: 'novo',
            hasChanges: true,
          });
        } else if (saveResult.hasChanges) {
          console.log(`  🔄 Documento atualizado: ${titulo}`);
          result.atualizados++;
          result.detalhes.push({
            titulo,
            status: 'atualizado',
            hasChanges: true,
          });
        } else {
          console.log(`  ⏭️  Sem mudanças: ${titulo}`);
          result.semMudancas++;
          result.detalhes.push({
            titulo,
            status: 'sem_mudanca',
            hasChanges: false,
          });
        }
      } else {
        console.log(`  ❌ Erro: ${saveResult.error}`);
        result.erros++;
        result.detalhes.push({
          titulo,
          status: 'erro',
          error: saveResult.error,
        });
      }
    }

    // Delay para não sobrecarregar o banco
    if (i < gazettes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\\n[DOU Module] Importação concluída!`);
  console.log(`  ✅ Novos: ${result.novos}`);
  console.log(`  🔄 Atualizados: ${result.atualizados}`);
  console.log(`  ⏭️  Sem mudanças: ${result.semMudancas}`);
  console.log(`  ❌ Erros: ${result.erros}`);

  return result;
}

/**
 * Converte resultado da API oficial do DOU para formato Document do Prisma
 */
function convertDOUResultToDocumentData(
  result: DOUSearchResult,
  relevanceScore: number,
  temas: string[],
  suggestedCourses: string[]
): Partial<Prisma.DocumentCreateInput> {
  // Remove tags HTML do título
  const title = result.title.replace(/<[^>]*>/g, '').trim();

  // Descrição (abstract já é limpo de HTML em dou-api.ts)
  const description = result.abstract || `Publicação do DOU - ${result.section} - ${result.date}`;

  // URL do documento
  const url = result.href;

  // Categoria baseada no conteúdo
  const category = detectCategoryDOU(title, description);

  // Type: sempre 'link' (URLs externas)
  const type = 'link';

  // Tags baseadas nos temas detectados
  const tags = JSON.stringify([
    'DOU',
    result.section.toUpperCase(),
    ...result.hierarchyList.slice(0, 3), // Primeiros 3 níveis da hierarquia
    ...temas,
  ]);

  // Curso sugerido (apenas o primeiro por enquanto - multi-curso será implementado depois)
  const courseId = suggestedCourses.length > 0 ? suggestedCourses[0] : null;

  // Sempre público (publicações do DOU são públicas)
  const isPublic = true;

  // Extrai informações adicionais do DOU
  const douInfo = extractDOUInfo(`${title} ${description} ${url}`);

  // Data de publicação (formato DD/MM/YYYY para Date)
  const [day, month, year] = result.date.split('/');
  const douData = new Date(`${year}-${month}-${day}`);

  return {
    title,
    description,
    url,
    category,
    type,
    tags,
    courseId,
    isPublic,
    // Dados do DOU (flat fields for backward compat)
    douUrl: url,
    douData,
    douSecao: result.section,
    douPagina: douInfo?.douPagina || undefined,
    douEdicao: undefined, // API oficial não retorna número de edição
    // Satellite table (metaDou)
    metaDou: {
      create: {
        url: url,
        data: douData,
        secao: result.section,
        pagina: douInfo?.douPagina || undefined,
        edicao: undefined,
      },
    },
  };
}

/**
 * Importa um documento da API oficial do DOU com versionamento
 */
export async function importDOUResultOfficial(
  result: DOUSearchResult
): Promise<{
  success: boolean;
  document?: Document;
  isNew?: boolean;
  hasChanges?: boolean;
  error?: string;
}> {
  try {
    // Remove tags HTML do título
    const title = result.title.replace(/<[^>]*>/g, '').trim();
    const content = result.abstract;

    // Análise de relevância
    const { isRelevant, score, temas } = analyzeRelevanceDOU(title, content);

    if (!isRelevant) {
      return {
        success: false,
        error: `Documento não relevante (score: ${score})`,
      };
    }

    // Sugestão de cursos
    const suggestedCourses = suggestCoursesDOU(title, content);

    // Converte para formato Document
    const documentData = convertDOUResultToDocumentData(
      result,
      score,
      temas,
      suggestedCourses
    );

    // Usar o sistema de versionamento (busca por título único)
    const versioningResult = await findOrCreateWithVersioning(
      { title: documentData.title! },
      documentData,
      'scraper-dou-oficial'
    );

    return {
      success: true,
      document: versioningResult.document,
      isNew: versioningResult.isNew,
      hasChanges: versioningResult.hasChanges,
    };
  } catch (error) {
    console.error(`[DOU Module] Erro ao importar documento ${result.title}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Importa múltiplos documentos da API oficial do DOU com versionamento
 *
 * Processa em lote e retorna estatísticas detalhadas
 */
export async function importDOUResultsOfficial(
  results: DOUSearchResult[]
): Promise<DOUImportResult> {
  console.log(`\\n[DOU Module] Iniciando importação de ${results.length} publicações DOU (API Oficial) com versionamento...\\n`);

  const result: DOUImportResult = {
    total: 0,
    novos: 0,
    atualizados: 0,
    semMudancas: 0,
    erros: 0,
    detalhes: [],
  };

  for (let i = 0; i < results.length; i++) {
    const douResult = results[i];
    result.total++;

    // Remove HTML do título para exibição
    const titulo = douResult.title.replace(/<[^>]*>/g, '').trim().slice(0, 100);

    console.log(`[${i + 1}/${results.length}] Processando: ${titulo}...`);

    const saveResult = await importDOUResultOfficial(douResult);

    if (saveResult.success) {
      if (saveResult.isNew) {
        console.log(`  ✅ Novo documento criado`);
        result.novos++;
        result.detalhes.push({
          titulo,
          status: 'novo',
          hasChanges: true,
        });
      } else if (saveResult.hasChanges) {
        console.log(`  🔄 Documento atualizado`);
        result.atualizados++;
        result.detalhes.push({
          titulo,
          status: 'atualizado',
          hasChanges: true,
        });
      } else {
        console.log(`  ⏭️  Sem mudanças`);
        result.semMudancas++;
        result.detalhes.push({
          titulo,
          status: 'sem_mudanca',
          hasChanges: false,
        });
      }
    } else {
      console.log(`  ❌ Erro: ${saveResult.error}`);
      result.erros++;
      result.detalhes.push({
        titulo,
        status: 'erro',
        error: saveResult.error,
      });
    }

    // Delay para não sobrecarregar o banco
    if (i < results.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\\n[DOU Module] Importação concluída!`);
  console.log(`  ✅ Novos: ${result.novos}`);
  console.log(`  🔄 Atualizados: ${result.atualizados}`);
  console.log(`  ⏭️  Sem mudanças: ${result.semMudancas}`);
  console.log(`  ❌ Erros: ${result.erros}`);

  return result;
}
