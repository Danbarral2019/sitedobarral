/**
 * TCU Module v2 - Com Sistema de Versionamento
 *
 * Integra o TCU Scraper com o sistema de versionamento automático,
 * aplicando as mesmas técnicas do AGU Scraper v4.
 *
 * Features:
 * - Versionamento automático de acórdãos
 * - Detecção de mudanças (sumário, URLs, situação)
 * - Keywords unificadas AGU + TCU
 * - Sugestão automática de cursos
 * - Estatísticas de importação
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { prisma } from '@/lib/prisma';
import type { Document, Prisma } from '@prisma/client';
import { findOrCreateWithVersioning } from './agu-modules/versioning';
import { KEYWORDS_RELEVANCIA, CURSOS_KEYWORDS, detectTemas } from './shared-keywords';
import type { AcordaoTCU } from './tcu-scraper';
import { apiLogger } from "@/lib/logger";

/**
 * Interface para resultado de importação
 */
export interface TCUImportResult {
  total: number;
  novos: number;
  atualizados: number;
  semMudancas: number;
  erros: number;
  detalhes: Array<{
    numero: string;
    status: 'novo' | 'atualizado' | 'sem_mudanca' | 'erro';
    hasChanges?: boolean;
    error?: string;
  }>;
}

/**
 * Converte AcordaoTCU para formato Document do Prisma
 */
function convertToDocumentData(acordao: AcordaoTCU): Partial<Prisma.DocumentCreateInput> {
  // Título formatado
  const title = `Acórdão ${acordao.numeroAcordao}/${acordao.anoAcordao} - TCU`;

  // Descrição = sumário
  const description = acordao.sumario || '';

  // URL preferencial: PDF > URL genérica > URL do acórdão
  const url = acordao.urlArquivoPDF || acordao.urlArquivo || acordao.urlAcordao || '';

  // Category sempre "acordao"
  const category = 'acordao';

  // Type: sempre 'link' (URLs externas)
  const type = 'link';

  // Tags baseadas nos temas detectados
  const temas = detectTemas(`${title} ${description}`);
  const tags = JSON.stringify([
    'TCU',
    'Acórdão',
    acordao.colegiado || 'Plenário',
    ...temas,
  ]);

  // Curso sugerido (apenas o primeiro por enquanto - multi-curso será implementado depois)
  const courseId = acordao.suggestedCourses.length > 0 ? acordao.suggestedCourses[0] : null;

  // Sempre público (acórdãos do TCU são públicos)
  const isPublic = true;

  // Campos específicos TCU
  // tcuNumeroAcordao deve conter o número completo (ex: "AC-2553/2025-P")
  const tcuNumeroAcordao = `${acordao.numeroAcordao}/${acordao.anoAcordao}`;
  const tcuOrgaoJulgador = acordao.colegiado || null;
  const tcuRelator = acordao.relator || null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tcuDataSessao = acordao.dataSessao || null;

  // Campos numéricos para ordenação (usam campos separados acordaoNumero e acordaoAno)
  const acordaoNumero = acordao.acordaoNumero;
  const acordaoAno = acordao.acordaoAno;

  return {
    title,
    description,
    url,
    category,
    type,
    tags,
    courseId, // Primeiro curso sugerido
    isPublic,
    tcuNumeroAcordao,
    tcuOrgaoJulgador,
    tcuRelator,
    acordaoNumero,
    acordaoAno,
  };
}

/**
 * Salva ou atualiza um acórdão TCU com versionamento
 */
export async function saveTCUAcordaoWithVersioning(
  acordao: AcordaoTCU
): Promise<{
  success: boolean;
  document?: Document;
  isNew?: boolean;
  hasChanges?: boolean;
  error?: string;
}> {
  try {
    if (!acordao.numeroAcordao || !acordao.anoAcordao) {
      return {
        success: false,
        error: 'Acórdão sem número ou ano',
      };
    }

    const documentData = convertToDocumentData(acordao);

    // Usar o sistema de versionamento (busca por título único)
    const result = await findOrCreateWithVersioning(
      { title: documentData.title! },
      documentData,
      'scraper-tcu'
    );

    return {
      success: true,
      document: result.document,
      isNew: result.isNew,
      hasChanges: result.hasChanges,
    };
  } catch (error) {
    apiLogger.error({ err: error }, `[TCU Module] Erro ao salvar acórdão ${acordao.numeroAcordao}/${acordao.anoAcordao}:`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Importa múltiplos acórdãos TCU com versionamento
 *
 * Processa em lote e retorna estatísticas detalhadas
 */
export async function importTCUAcordaosWithVersioning(
  acordaos: AcordaoTCU[]
): Promise<TCUImportResult> {
  console.log(`\n[TCU Module] Iniciando importação de ${acordaos.length} acórdãos com versionamento...\n`);

  const result: TCUImportResult = {
    total: acordaos.length,
    novos: 0,
    atualizados: 0,
    semMudancas: 0,
    erros: 0,
    detalhes: [],
  };

  for (let i = 0; i < acordaos.length; i++) {
    const acordao = acordaos[i];
    const numero = `${acordao.numeroAcordao}/${acordao.anoAcordao}`;

    console.log(`[${i + 1}/${acordaos.length}] Processando Acórdão ${numero}...`);

    const saveResult = await saveTCUAcordaoWithVersioning(acordao);

    if (saveResult.success) {
      if (saveResult.isNew) {
        console.log(`  ✅ Novo acórdão criado`);
        result.novos++;
        result.detalhes.push({
          numero,
          status: 'novo',
          hasChanges: true,
        });
      } else if (saveResult.hasChanges) {
        console.log(`  🔄 Acórdão atualizado (mudanças detectadas)`);
        result.atualizados++;
        result.detalhes.push({
          numero,
          status: 'atualizado',
          hasChanges: true,
        });
      } else {
        console.log(`  ⏭️  Sem mudanças (versão já existe)`);
        result.semMudancas++;
        result.detalhes.push({
          numero,
          status: 'sem_mudanca',
          hasChanges: false,
        });
      }
    } else {
      console.log(`  ❌ Erro: ${saveResult.error}`);
      result.erros++;
      result.detalhes.push({
        numero,
        status: 'erro',
        error: saveResult.error,
      });
    }

    // Delay para não sobrecarregar o banco
    if (i < acordaos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n[TCU Module] Importação concluída!`);
  console.log(`  ✅ Novos: ${result.novos}`);
  console.log(`  🔄 Atualizados: ${result.atualizados}`);
  console.log(`  ⏭️  Sem mudanças: ${result.semMudancas}`);
  console.log(`  ❌ Erros: ${result.erros}`);

  return result;
}

/**
 * Analisa relevância usando keywords unificadas
 *
 * Esta função substitui a do tcu-scraper.ts antigo,
 * usando o sistema unificado de keywords.
 */
export function analyzeRelevanceTCU(
  titulo: string,
  sumario: string
): {
  isRelevant: boolean;
  score: number;
  temas: string[];
} {
  const text = `${titulo} ${sumario}`.toLowerCase();
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

  // Threshold: score >= 10 = relevante
  const isRelevant = score >= 10;

  // Detectar temas
  const temas = detectTemas(text);

  return { isRelevant, score, temas };
}

/**
 * Sugere cursos usando keywords unificadas
 */
export function suggestCoursesTCU(titulo: string, sumario: string): string[] {
  const text = `${titulo} ${sumario}`.toLowerCase();
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
