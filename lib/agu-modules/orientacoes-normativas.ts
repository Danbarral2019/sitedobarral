/**
 * AGU Scraper v4 - Módulo de Orientações Normativas
 *
 * Versão melhorada com Playwright MCP para navegação robusta
 */

import type { AGUDocument, AGUScraperConfig, AGUScraperResult } from '../agu-types';
import type { Document as PrismaDocument } from '@prisma/client';
import {
  analyzeRelevancia,
  suggestCursos,
  normalizeUrl,
  isValidUrl,
  isProblematicUrl,
  extractNumeroAno,
  cleanHtml,
  truncate,
  extractTags,
  sleep,
  extractDOUInfo,
} from './helpers';
import { findOrCreateWithVersioning } from './versioning';

/**
 * Interface para dados brutos de uma ON extraída do HTML
 */
interface OrientacaoNormativaRaw {
  numero: string;
  ano: string;
  titulo: string;
  descricao: string;
  linkFundamentacao?: string;
  fundamentacaoLinks: string[];
  linkDOU?: string;
  versaoHistorica?: string;
}

/**
 * Scrape Orientações Normativas usando Playwright MCP
 *
 * NOTA: Esta é uma versão preparada para Playwright MCP.
 * No entanto, como o Playwright MCP ainda não está totalmente integrado
 * no código TypeScript direto, mantemos compatibilidade com fetch HTTP.
 *
 * Quando você estiver usando Claude Code com Playwright MCP ativo,
 * poderá pedir: "Use Playwright para scrape ONs da AGU" e o MCP
 * executará navegação real no navegador.
 */
export async function scrapeOrientacoesNormativas(
  config: AGUScraperConfig
): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('[AGU ONs] Iniciando scraping de Orientações Normativas...');

  try {
    // Por enquanto, usa fetch HTTP (compatível com ambiente atual)
    // TODO: Quando Playwright MCP estiver disponível via código, trocar por:
    // const page = await playwright.newPage();
    // await page.goto('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu');

    const response = await fetch('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('[AGU ONs] HTML carregado, parseando...');

    // Parse HTML para extrair ONs
    const onsRaw = parseOrientacoesFromHTML(html);
    console.log(`[AGU ONs] ${onsRaw.length} ONs encontradas`);

    // Converte para formato AGUDocument
    const documentos: AGUDocument[] = [];

    for (const onRaw of onsRaw) {
      // Filtra por ano se configurado
      if (config.anoInicio && parseInt(onRaw.ano) < config.anoInicio) continue;
      if (config.anoFim && parseInt(onRaw.ano) > config.anoFim) continue;

      // IMPORTANTE: Todas as ONs são relevantes por natureza (orientações da AGU sobre licitações)
      // Apenas analisa para sugerir cursos e extrair temas, mas NUNCA filtra
      const { score, temas } = analyzeRelevancia(onRaw.titulo, onRaw.descricao);
      const isRelevante = true; // Sempre relevante!

      // Sugere cursos baseado no conteúdo
      const cursosIds = suggestCursos(onRaw.titulo, onRaw.descricao);

      // Extrai número e ano
      const { numero, ano } = extractNumeroAno(onRaw.numero);

      // Extrai tags
      const tags = extractTags(`${onRaw.titulo} ${onRaw.descricao}`, ['AGU', onRaw.numero]);

      // URL principal
      const url = onRaw.linkFundamentacao || 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';
      const urlPDF = onRaw.linkFundamentacao?.endsWith('.pdf') ? onRaw.linkFundamentacao : undefined;

      // URLs alternativas (fundamentações múltiplas)
      const urlsAlternativas = onRaw.fundamentacaoLinks.length > 1
        ? onRaw.fundamentacaoLinks.slice(1)
        : undefined;

      // Extrai informações do DOU se houver link
      const douInfo = onRaw.linkDOU ? extractDOUInfo(onRaw.linkDOU) : null;

      const documento: AGUDocument = {
        tipo: 'orientacao-normativa',
        numero: onRaw.numero,
        ano: ano,
        numeroInt: numero,
        titulo: truncate(`Orientação Normativa AGU nº ${numero}/${ano}`, 200),
        descricao: truncate(onRaw.descricao || `Orientação Normativa da AGU nº ${onRaw.numero}`, 1000),
        url,
        urlPDF,
        urlsAlternativas,
        tags,
        isRelevante,
        relevanciaScore: score,
        temas,
        cursosIds,
        versaoHistorica: onRaw.versaoHistorica,
        // Dados do DOU (se disponíveis)
        douUrl: douInfo?.douUrl,
        douData: douInfo?.douData,
        douSecao: douInfo?.douSecao,
        douPagina: douInfo?.douPagina,
        douEdicao: douInfo?.douEdicao,
      };

      documentos.push(documento);
    }

    const executionTime = Date.now() - startTime;

    console.log(`[AGU ONs] ✅ Scraping concluído em ${executionTime}ms`);
    console.log(`[AGU ONs] Total: ${documentos.length} | Relevantes: ${documentos.filter(d => d.isRelevante).length}`);

    return {
      success: true,
      tipo: 'orientacao-normativa',
      documentos,
      total: documentos.length,
      totalRelevante: documentos.filter(d => d.isRelevante).length,
      executionTime,
      errors,
      warnings,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    console.error('[AGU ONs] ❌ Erro:', errorMsg);

    return {
      success: false,
      tipo: 'orientacao-normativa',
      documentos: [],
      total: 0,
      totalRelevante: 0,
      executionTime: Date.now() - startTime,
      errors,
      warnings,
    };
  }
}

/**
 * Parse HTML para extrair Orientações Normativas
 *
 * VERSÃO MELHORADA: Mais robusta que a v3, com fallbacks
 */
function parseOrientacoesFromHTML(html: string): OrientacaoNormativaRaw[] {
  const orientacoes: OrientacaoNormativaRaw[] = [];
  const foundONs = new Set<string>();

  // Limpa HTML
  const cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Padrões para encontrar ONs
  const patterns = [
    /\*\*\[Orientação Normativa\s+(\d{1,3})\/(\d{4})\]\(([^)]+)\)\*\*/gi,
    /\[Orientação Normativa\s+(\d{1,3})\/(\d{4})\]\(([^)]+)\)/gi,
    /Orientação Normativa\s+(\d{1,3})\/(\d{4})/gi,
  ];

  let match;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    while ((match = pattern.exec(cleanedHtml)) !== null) {
      const numero = match[1];
      const ano = match[2];
      const numeroCompleto = `${numero.padStart(3, '0')}/${ano}`;

      // Evita duplicatas
      if (foundONs.has(numeroCompleto)) continue;
      foundONs.add(numeroCompleto);

      const matchPosition = match.index;

      // Extrai bloco de conteúdo dessa ON
      const nextONMatch = cleanedHtml.slice(matchPosition + match[0].length)
        .search(/Orientação Normativa\s+\d{1,3}\/\d{4}/i);

      const blockEnd = nextONMatch > 0
        ? matchPosition + match[0].length + nextONMatch
        : matchPosition + 3000;

      const block = cleanedHtml.slice(matchPosition, blockEnd);

      // Extrai dados da ON
      const on = extractOrientacaoFromBlock(numero, ano, block);
      orientacoes.push(on);
    }
  }

  // Ordena por ano (desc) e número (asc)
  orientacoes.sort((a, b) => {
    const anoA = parseInt(a.ano);
    const anoB = parseInt(b.ano);

    if (anoA !== anoB) return anoB - anoA; // Mais recente primeiro

    const numA = parseInt(a.numero.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.numero.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  return orientacoes;
}

/**
 * Extrai informações de uma ON a partir do seu bloco
 */
function extractOrientacaoFromBlock(numero: string, ano: string, block: string): OrientacaoNormativaRaw {
  const numeroDisplay = `ON ${parseInt(numero)}/${ano}`;

  // Extrai título/enunciado
  let titulo = '';

  const enunciadoMatch = block.match(/Enunciado[:\s]*([^<\n]+)/i);
  if (enunciadoMatch) {
    titulo = cleanHtml(enunciadoMatch[1]);
  } else {
    // Fallback: procura texto longo após o número
    const textMatch = block.match(/Orientação Normativa\s+\d{1,3}\/\d{4}[^\n]*\n+([^<\n]{20,})/i);
    if (textMatch) {
      titulo = cleanHtml(textMatch[1]);
    }
  }

  // Remove atributos HTML soltos
  titulo = titulo
    .replace(/data-[\w-]+="[^"]*"/g, '')
    .replace(/class="[^"]*"/g, '')
    .replace(/href="[^"]*"/g, '')
    .trim();

  // Fallback se não encontrou
  if (!titulo || titulo.length < 10) {
    titulo = `Orientação Normativa ${numeroDisplay}`;
  }

  // Trunca título
  titulo = truncate(titulo, 200);

  // Extrai descrição
  const descricao = extractDescription(block, titulo);

  // Extrai links de fundamentação
  const fundamentacaoLinks = extractFundamentacaoLinks(block);

  // Link principal
  const linkFundamentacao = fundamentacaoLinks[0];

  // Link do DOU
  const linkDOU = extractDouLink(block);

  // Versão histórica
  const versaoHistorica = extractVersaoHistorica(block);

  return {
    numero: numeroDisplay,
    ano,
    titulo,
    descricao,
    linkFundamentacao,
    fundamentacaoLinks,
    linkDOU,
    versaoHistorica,
  };
}

/**
 * Extrai descrição do bloco
 */
function extractDescription(block: string, titulo: string): string {
  let content = block.replace(titulo, '');
  content = cleanHtml(content);

  const paragraphs = content
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 30 && !p.match(/^(Fundamentação|Publicação|DOU|Redação)/i))
    .slice(0, 3);

  return paragraphs.join(' ').substring(0, 800).trim();
}

/**
 * Extrai links de fundamentação
 */
function extractFundamentacaoLinks(block: string): string[] {
  const links = new Set<string>();

  // Padrão 1: [Fundamentação](URL)
  const pattern1 = /\[Fundamentação\]\(([^)]+)\)/gi;
  let match;

  while ((match = pattern1.exec(block)) !== null) {
    const url = normalizeUrl(match[1]);
    if (isValidUrl(url) && !isProblematicUrl(url)) {
      links.add(url);
    }
  }

  // Padrão 2: Links numerados
  const pattern2 = /Fundamentação\s*\([^)]*\[(\d+)\]\(([^)]+)\)[^)]*\)/gi;
  while ((match = pattern2.exec(block)) !== null) {
    const url = normalizeUrl(match[2]);
    if (isValidUrl(url) && !isProblematicUrl(url)) {
      links.add(url);
    }
  }

  // Padrão 3: PDFs diretos
  const pattern3 = /href="([^"]*fundamentacao[^"]*\.pdf[^"]*)"/gi;
  while ((match = pattern3.exec(block)) !== null) {
    const url = normalizeUrl(match[1]);
    if (isValidUrl(url) && !isProblematicUrl(url)) {
      links.add(url);
    }
  }

  return Array.from(links);
}

/**
 * Extrai link do DOU
 */
function extractDouLink(block: string): string | undefined {
  const patterns = [
    /\[(?:Publicação no )?DOU\]\(([^)]+)\)/i,
    /href="([^"]*in\.gov\.br[^"]*)"/i,
  ];

  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) {
      const url = normalizeUrl(match[1]);
      // DOU links são problemáticos, mas mantemos para referência
      if (isValidUrl(url)) return url;
    }
  }

  return undefined;
}

/**
 * Extrai versão histórica
 */
function extractVersaoHistorica(block: string): string | undefined {
  const match = block.match(/(Redação\s+(original\s+)?de\s+\d{4})/i);
  return match ? match[1] : undefined;
}

/**
 * Converte AGUDocument para formato de Document do Prisma
 */
function convertToDocumentData(aguDoc: AGUDocument) {
  return {
    title: aguDoc.titulo,
    description: aguDoc.descricao,
    type: aguDoc.urlPDF ? 'pdf' as const : 'link' as const,
    url: aguDoc.url,
    category: 'orientacao-normativa',
    isPublic: true,
    onNumber: aguDoc.numeroInt || undefined,
    onYear: aguDoc.ano || undefined,

    // Tags e cursos
    tags: JSON.stringify(aguDoc.tags),

    // URLs alternativas
    alternativeUrls: aguDoc.urlsAlternativas ? JSON.stringify(aguDoc.urlsAlternativas) : undefined,

    // Dados do DOU (Diário Oficial da União)
    douUrl: aguDoc.douUrl || undefined,
    douData: aguDoc.douData ? parseDateBR(aguDoc.douData) : undefined,
    douSecao: aguDoc.douSecao || undefined,
    douPagina: aguDoc.douPagina || undefined,
    douEdicao: aguDoc.douEdicao || undefined,

    // Análise de IA
    aiClassification: JSON.stringify({
      category: 'orientacao-normativa',
      courses: aguDoc.cursosIds,
      relevanceScore: aguDoc.relevanciaScore,
      reasoning: `Temas: ${aguDoc.temas.join(', ')}`,
      confidence: aguDoc.relevanciaScore >= 70 ? 'high' : aguDoc.relevanciaScore >= 40 ? 'medium' : 'low'
    }),

    // Conteúdo adicional
    content: aguDoc.descricao,
  };
}

/**
 * Converte data brasileira (DD/MM/YYYY) para objeto Date
 */
function parseDateBR(dataBR: string): Date | undefined {
  const match = dataBR.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return undefined;

  const [, dia, mes, ano] = match;
  return new Date(`${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`);
}

/**
 * Salva ou atualiza uma Orientação Normativa no banco com versionamento
 */
export async function saveOrientacaoNormativaWithVersioning(
  aguDoc: AGUDocument
): Promise<{
  success: boolean;
  document?: PrismaDocument;
  isNew?: boolean;
  hasChanges?: boolean;
  error?: string;
}> {
  try {
    if (!aguDoc.numeroInt || !aguDoc.ano) {
      return {
        success: false,
        error: 'Documento sem número ou ano válido'
      };
    }

    // Usa sistema de versionamento
    const result = await findOrCreateWithVersioning(
      { onNumber: aguDoc.numeroInt, onYear: aguDoc.ano },
      convertToDocumentData(aguDoc),
      'scraper-ons-agu'
    );

    return {
      success: true,
      document: result.document,
      isNew: result.isNew,
      hasChanges: result.hasChanges
    };

  } catch (error) {
    console.error('[AGU ONs] Erro ao salvar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Importa todas as ONs extraídas com versionamento automático
 */
export async function importOrientacoesNormativasWithVersioning(
  documentos: AGUDocument[]
): Promise<{
  total: number;
  novos: number;
  atualizados: number;
  semMudancas: number;
  erros: number;
  detalhes: Array<{
    numero: string;
    status: 'novo' | 'atualizado' | 'sem_mudancas' | 'erro';
    error?: string;
  }>;
}> {
  console.log(`\n[AGU ONs] 📥 Iniciando importação de ${documentos.length} ONs com versionamento...`);

  let novos = 0;
  let atualizados = 0;
  let semMudancas = 0;
  let erros = 0;
  const detalhes: Array<{ numero: string; status: 'novo' | 'atualizado' | 'sem_mudancas' | 'erro'; error?: string }> = [];

  for (const doc of documentos) {
    const result = await saveOrientacaoNormativaWithVersioning(doc);

    if (!result.success) {
      erros++;
      detalhes.push({
        numero: doc.numero || 'Desconhecido',
        status: 'erro',
        error: result.error
      });
      console.error(`   ❌ ${doc.numero}: ${result.error}`);
      continue;
    }

    if (result.isNew) {
      novos++;
      detalhes.push({ numero: doc.numero || 'Desconhecido', status: 'novo' });
      console.log(`   ✅ NOVO: ${doc.numero} - ${doc.titulo.substring(0, 60)}...`);
    } else if (result.hasChanges) {
      atualizados++;
      detalhes.push({ numero: doc.numero || 'Desconhecido', status: 'atualizado' });
      console.log(`   🔄 ATUALIZADO: ${doc.numero}`);
    } else {
      semMudancas++;
      detalhes.push({ numero: doc.numero || 'Desconhecido', status: 'sem_mudancas' });
      console.log(`   ⏭️  Sem mudanças: ${doc.numero}`);
    }

    // Delay para não sobrecarregar banco
    await sleep(100);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Resumo da Importação de ONs');
  console.log('='.repeat(60));
  console.log(`✅ Novos: ${novos}`);
  console.log(`🔄 Atualizados: ${atualizados}`);
  console.log(`⏭️  Sem mudanças: ${semMudancas}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`📈 Total processado: ${documentos.length}`);
  console.log('='.repeat(60));

  return {
    total: documentos.length,
    novos,
    atualizados,
    semMudancas,
    erros,
    detalhes
  };
}
