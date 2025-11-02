/**
 * AGU Scraper v4 - Plataforma Completa de Scraping
 *
 * Sistema unificado com Playwright MCP para coletar todos os tipos
 * de documentos relevantes da AGU sobre licitações e contratos.
 *
 * TYPES SUPORTADOS:
 * - Orientações Normativas (ONs)
 * - Pareceres Vinculantes
 * - Súmulas AGU
 * - Modelos de Licitações/Contratos
 * - Guias e Manuais
 * - Notas Técnicas (futuro)
 *
 * FEATURES:
 * - Scraping robusto com Playwright MCP
 * - Análise inteligente de relevância
 * - Sugestão automática de cursos
 * - Filtragem por ano e relevância
 * - Screenshots para debug
 * - Rate limiting automático
 * - Detecção de documentos novos
 */

import type {
  AGUDocumentType,
  AGUScraperConfig,
  AGUScraperResult,
  AGUScraperStats,
  AGUDocument,
} from './agu-types';

import { scrapeOrientacoesNormativas } from './agu-modules/orientacoes-normativas';
import { scrapeSumulas } from './agu-modules/sumulas';
import { scrapeParecerVinculante } from './agu-modules/pareceres-vinculantes';
import { scrapeParecerCONUNI } from './agu-modules/pareceres-conuni';

/**
 * ORQUESTRADOR PRINCIPAL
 *
 * Executa scraping de múltiplos tipos de documentos AGU
 */
export async function scrapeAGU(config: AGUScraperConfig): Promise<{
  success: boolean;
  results: AGUScraperResult[];
  stats: AGUScraperStats;
  totalDocuments: number;
  totalRelevant: number;
  executionTime: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const results: AGUScraperResult[] = [];
  const allErrors: string[] = [];

  console.log('[AGU Scraper v4] 🚀 Iniciando scraping...');
  console.log('[AGU Scraper v4] Tipos:', config.tipos.join(', '));

  // Configuração padrão
  const defaultConfig: AGUScraperConfig = {
    tipos: config.tipos || ['orientacao-normativa'],
    filtroRelevancia: config.filtroRelevancia ?? true,
    saveScreenshots: config.saveScreenshots ?? false,
    delayMs: config.delayMs ?? 1000,
    timeout: config.timeout ?? 30000,
    ...config,
  };

  // Executa scraping de cada tipo
  for (const tipo of defaultConfig.tipos) {
    console.log(`\n[AGU Scraper v4] 📄 Processando: ${tipo}...`);

    try {
      let result: AGUScraperResult;

      switch (tipo) {
        case 'orientacao-normativa':
          result = await scrapeOrientacoesNormativas(defaultConfig);
          break;

        case 'parecer-vinculante':
          result = await scrapeParecerVinculante(defaultConfig);
          break;

        case 'sumula':
          result = await scrapeSumulas(defaultConfig);
          break;

        case 'parecer-conuni':
          result = await scrapeParecerCONUNI(defaultConfig);
          break;

        case 'modelo':
          result = await scrapeModelos(defaultConfig);
          break;

        case 'guia':
          result = await scrapeGuias(defaultConfig);
          break;

        case 'nota-tecnica':
          result = await scrapeNotasTecnicas(defaultConfig);
          break;

        default:
          console.warn(`[AGU Scraper v4] ⚠️ Tipo desconhecido: ${tipo}`);
          continue;
      }

      results.push(result);

      if (!result.success) {
        allErrors.push(...result.errors);
      }

      console.log(`[AGU Scraper v4] ✅ ${tipo}: ${result.totalRelevante}/${result.total} documentos`);

      // Rate limiting entre tipos
      if (defaultConfig.delayMs && defaultConfig.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, defaultConfig.delayMs));
      }

    } catch (error) {
      const errorMsg = `Erro em ${tipo}: ${error instanceof Error ? error.message : String(error)}`;
      allErrors.push(errorMsg);
      console.error(`[AGU Scraper v4] ❌ ${errorMsg}`);
    }
  }

  // Agrega todos os documentos
  const allDocuments = results.flatMap(r => r.documentos);
  const totalDocuments = allDocuments.length;
  const totalRelevant = allDocuments.filter(d => d.isRelevante).length;

  // Gera estatísticas
  const stats = generateStats(allDocuments);

  const executionTime = Date.now() - startTime;

  console.log(`\n[AGU Scraper v4] 🎉 Scraping concluído em ${(executionTime / 1000).toFixed(2)}s`);
  console.log(`[AGU Scraper v4] 📊 Total: ${totalDocuments} | Relevantes: ${totalRelevant}`);
  console.log(`[AGU Scraper v4] 📊 Taxa de relevância: ${stats.taxaRelevancia.toFixed(1)}%`);

  return {
    success: allErrors.length === 0,
    results,
    stats,
    totalDocuments,
    totalRelevant,
    executionTime,
    errors: allErrors,
  };
}

// Módulo de Pareceres Vinculantes implementado em './agu-modules/pareceres-vinculantes'

// Módulo de Súmulas AGU implementado em './agu-modules/sumulas'

/**
 * MÓDULO: Modelos de Licitações e Contratos
 */
async function scrapeModelos(config: AGUScraperConfig): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const documentos: AGUDocument[] = [];
  const errors: string[] = [];

  console.log('[AGU Modelos] Scraping de Modelos...');

  try {
    console.log('[AGU Modelos] ⚠️ Módulo em implementação');

    return {
      success: true,
      tipo: 'modelo',
      documentos,
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings: ['Módulo em implementação'],
    };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));

    return {
      success: false,
      tipo: 'modelo',
      documentos: [],
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings: [],
    };
  }
}

/**
 * MÓDULO: Guias e Manuais
 */
async function scrapeGuias(config: AGUScraperConfig): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const documentos: AGUDocument[] = [];
  const errors: string[] = [];

  console.log('[AGU Guias] Scraping de Guias e Manuais...');

  try {
    console.log('[AGU Guias] ⚠️ Módulo em implementação');

    return {
      success: true,
      tipo: 'guia',
      documentos,
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings: ['Módulo em implementação'],
    };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));

    return {
      success: false,
      tipo: 'guia',
      documentos: [],
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings: [],
    };
  }
}

/**
 * MÓDULO: Notas Técnicas
 */
async function scrapeNotasTecnicas(config: AGUScraperConfig): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const documentos: AGUDocument[] = [];
  const errors: string[] = [];

  console.log('[AGU Notas] Scraping de Notas Técnicas...');

  try {
    console.log('[AGU Notas] ⚠️ Módulo em implementação');

    return {
      success: true,
      tipo: 'nota-tecnica',
      documentos,
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings: ['Módulo em implementação'],
    };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));

    return {
      success: false,
      tipo: 'nota-tecnica',
      documentos: [],
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings: [],
    };
  }
}

/**
 * Gera estatísticas agregadas do scraping
 */
function generateStats(documentos: AGUDocument[]): AGUScraperStats {
  const porTipo: Record<string, number> = {};
  const porAno: Record<string, number> = {};
  const porCurso: Record<string, number> = {};
  const porTema: Record<string, number> = {};

  let totalScore = 0;
  let totalRelevante = 0;

  for (const doc of documentos) {
    // Por tipo
    porTipo[doc.tipo] = (porTipo[doc.tipo] || 0) + 1;

    // Por ano
    if (doc.ano) {
      porAno[doc.ano.toString()] = (porAno[doc.ano.toString()] || 0) + 1;
    }

    // Por curso
    for (const cursoId of doc.cursosIds) {
      porCurso[cursoId] = (porCurso[cursoId] || 0) + 1;
    }

    // Por tema
    for (const tema of doc.temas) {
      porTema[tema] = (porTema[tema] || 0) + 1;
    }

    // Score
    totalScore += doc.relevanciaScore;
    if (doc.isRelevante) {
      totalRelevante++;
    }
  }

  const taxaRelevancia = documentos.length > 0
    ? (totalRelevante / documentos.length) * 100
    : 0;

  const scoreMedio = documentos.length > 0
    ? totalScore / documentos.length
    : 0;

  return {
    porTipo: porTipo as Record<AGUDocumentType, number>,
    porAno,
    porCurso,
    porTema,
    taxaRelevancia,
    scoreMedio,
    totalGeral: documentos.length,
    totalRelevante,
    tempoTotal: 0, // Será preenchido pelo caller
  };
}

/**
 * Converte documentos AGU para formato de importação no banco
 */
export function convertAGUDocumentsToImport(documentos: AGUDocument[]): Array<{
  title: string;
  description: string;
  category: string;
  type: string;
  url: string;
  tags: string[];
  isPublic: boolean;
  courseIds: string[];
  onNumber?: number;
  onYear?: number;
  alternativeUrls?: string;
}> {
  return documentos.map(doc => ({
    title: doc.titulo,
    description: doc.descricao,
    category: doc.tipo,
    type: doc.urlPDF ? 'pdf' : 'link',
    url: doc.url,
    tags: doc.tags,
    isPublic: true,
    courseIds: doc.cursosIds,
    onNumber: doc.numeroInt,
    onYear: doc.ano,
    alternativeUrls: doc.urlsAlternativas ? JSON.stringify(doc.urlsAlternativas) : undefined,
  }));
}

/**
 * Gera relatório Excel para revisão manual
 */
export function generateAGUExcelReport(documentos: AGUDocument[]): string[][] {
  const headers = [
    'Tipo',
    'Numero',
    'Ano',
    'Titulo',
    'Descricao',
    'Categoria',
    'Curso',
    'Publico',
    'Tags',
    'URL',
    'Relevancia',
    'Score',
    'Temas',
  ];

  const rows = documentos.map(doc => [
    doc.tipo,
    doc.numero || '',
    doc.ano?.toString() || '',
    doc.titulo,
    doc.descricao,
    doc.tipo,
    doc.cursosIds.join(', '),
    'Sim',
    doc.tags.join(', '),
    doc.url,
    doc.isRelevante ? 'Sim' : 'Não',
    doc.relevanciaScore.toString(),
    doc.temas.join(', '),
  ]);

  return [headers, ...rows];
}
