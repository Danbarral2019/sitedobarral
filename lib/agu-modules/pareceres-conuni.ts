/**
 * AGU Scraper v4 - Módulo de Pareceres CONUNI (DECOR)
 *
 * Scraping de pareceres da Consultoria Nacional da União de Uniformização (CONUNI)
 * usando Playwright MCP (conteúdo carregado via JavaScript)
 *
 * URL: https://cgu.agu.gov.br/decor/
 */

import type { AGUDocument, AGUScraperConfig, AGUScraperResult } from '../agu-types';
import {
  analyzeRelevancia,
  suggestCursos,
  normalizeUrl,
  cleanHtml,
  truncate,
  extractTags,
} from './helpers';

/**
 * Interface para dados brutos de um Parecer CONUNI extraído do sistema DECOR
 */
interface ParecerCONUNIRaw {
  numero: string;
  ano: string;
  tipo: string; // Manifestação, Despacho do Coordenador, etc.
  assunto: string;
  ementa: string;
  vigencia: string; // Vigente, Revogado Totalmente, etc.
  aprovacao?: string;
  linkArquivo?: string;
  nup?: string;
  orgaoInteressado?: string;
  camaraTematica?: string;
}

/**
 * Scrape Pareceres CONUNI usando Playwright MCP
 *
 * IMPORTANTE: Esta função requer Playwright MCP instalado
 * pois a página carrega pareceres via JavaScript dinâmico.
 *
 * Como usar:
 * 1. Certifique-se que Playwright MCP está instalado (`claude mcp list`)
 * 2. Use via Claude Code CLI: "Use Playwright para scrape pareceres CONUNI"
 * 3. Ou aguarde integração direta de Playwright no código
 */
export async function scrapeParecerCONUNI(
  config: AGUScraperConfig
): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('[AGU DECOR] Iniciando scraping de Pareceres CONUNI...');
  console.log('[AGU DECOR] ⚠️ Página requer Playwright MCP (JavaScript dinâmico)');

  try {
    // OPÇÃO 1: Usar Playwright MCP via Claude Code
    // (ideal quando disponível)
    warnings.push('Playwright MCP recomendado - use via Claude Code CLI');
    warnings.push('Comando: "Use Playwright para navegar até https://cgu.agu.gov.br/decor/ e extrair pareceres CONUNI"');

    // OPÇÃO 2: Fallback com fetch HTTP
    // (limitado - pode não pegar conteúdo JavaScript)
    console.log('[AGU DECOR] Tentando fallback com fetch HTTP...');

    const response = await fetch('https://cgu.agu.gov.br/decor/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('[AGU DECOR] HTML carregado (pode estar vazio se usar JS)');

    // Tenta parsear (provavelmente não encontrará nada)
    const pareceresRaw = parseParecerFromHTML(html);
    console.log(`[AGU DECOR] ${pareceresRaw.length} pareceres encontrados (fallback)`);

    if (pareceresRaw.length === 0) {
      warnings.push('Nenhum parecer encontrado - página usa JavaScript para carregar dados');
      warnings.push('Use Playwright MCP para resultados completos');
      warnings.push('Alternativamente, pode existir uma API REST que podemos usar');
    }

    // Converte para formato AGUDocument
    const documentos: AGUDocument[] = [];

    for (const parecerRaw of pareceresRaw) {
      const ano = parseInt(parecerRaw.ano);

      // Filtra por ano se configurado
      if (config.anoInicio && ano < config.anoInicio) continue;
      if (config.anoFim && ano > config.anoFim) continue;

      // Analisa relevância
      const textoCompleto = `${parecerRaw.assunto} ${parecerRaw.ementa}`;
      const { isRelevante, score, temas } = analyzeRelevancia(parecerRaw.assunto, textoCompleto);

      // Filtra por relevância se configurado
      if (config.filtroRelevancia && !isRelevante) continue;

      // Pula se não estiver vigente (a menos que config permita)
      if (parecerRaw.vigencia.includes('Revogado') && config.filtroRelevancia) {
        console.log(`[AGU DECOR] ⚠️ Parecer ${parecerRaw.numero}/${ano} revogado, pulando`);
        continue;
      }

      // Sugere cursos
      const cursosIds = suggestCursos(parecerRaw.assunto, textoCompleto);

      // Extrai número numérico
      const numeroMatch = parecerRaw.numero.match(/\d+/);
      const numeroInt = numeroMatch ? parseInt(numeroMatch[0]) : undefined;

      // Extrai tags
      const tags = extractTags(textoCompleto, ['AGU', 'CONUNI', 'DECOR', parecerRaw.tipo]);

      // Adiciona status como tag
      if (parecerRaw.vigencia !== 'Vigente') {
        tags.push(parecerRaw.vigencia);
      }

      // URL principal
      const url = parecerRaw.linkArquivo || 'https://cgu.agu.gov.br/decor/';
      const urlPDF = parecerRaw.linkArquivo?.endsWith('.pdf') ? parecerRaw.linkArquivo : undefined;

      const documento: AGUDocument = {
        tipo: 'parecer-conuni',
        numero: `${parecerRaw.numero}/${ano}`,
        ano: ano,
        numeroInt: numeroInt,
        titulo: truncate(`${parecerRaw.tipo} CONUNI nº ${parecerRaw.numero}/${ano}`, 200),
        descricao: truncate(parecerRaw.ementa || parecerRaw.assunto, 1000),
        url,
        urlPDF,
        tags,
        isRelevante,
        relevanciaScore: score,
        temas,
        cursosIds,
      };

      documentos.push(documento);
    }

    const executionTime = Date.now() - startTime;

    console.log(`[AGU DECOR] ✅ Scraping concluído em ${executionTime}ms`);
    console.log(`[AGU DECOR] Total: ${documentos.length} | Relevantes: ${documentos.filter(d => d.isRelevante).length}`);

    return {
      success: pareceresRaw.length > 0,
      tipo: 'parecer-conuni',
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
    console.error('[AGU DECOR] ❌ Erro:', errorMsg);

    return {
      success: false,
      tipo: 'parecer-conuni',
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
 * Parse HTML para extrair Pareceres CONUNI
 *
 * NOTA: Esta função pode retornar array vazio se a página
 * carregar pareceres via JavaScript (que é o caso).
 *
 * Para scraping completo, use Playwright MCP.
 */
function parseParecerFromHTML(html: string): ParecerCONUNIRaw[] {
  const pareceres: ParecerCONUNIRaw[] = [];

  // Limpa HTML
  const cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Tenta encontrar pareceres no HTML estático
  // (provavelmente não funcionará se usar JavaScript)

  // O sistema DECOR usa uma estrutura de tabela ou lista
  // Padrão 1: Procura por elementos com classe "manifestacao" ou similar
  const itemPattern = /<div[^>]*class="[^"]*manifestacao[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const itemMatches = [...cleanedHtml.matchAll(itemPattern)];

  for (const match of itemMatches) {
    const block = match[1];

    // Extrai número e ano
    const numeroMatch = block.match(/(?:Nº|Número|N\.)\s*(\d+)[\/\-](\d{4})/i);
    if (!numeroMatch) continue;

    const numero = numeroMatch[1];
    const ano = numeroMatch[2];

    // Extrai tipo
    const tipoMatch = block.match(/<strong[^>]*>([^<]+)<\/strong>/i);
    const tipo = tipoMatch ? cleanHtml(tipoMatch[1]) : 'Manifestação';

    // Extrai assunto
    const assuntoMatch = block.match(/Assunto:?\s*([^<]+)/i);
    const assunto = assuntoMatch ? cleanHtml(assuntoMatch[1]) : '';

    // Extrai ementa
    const ementaMatch = block.match(/Ementa:?\s*([^<]+)/i);
    const ementa = ementaMatch ? cleanHtml(ementaMatch[1]) : assunto;

    // Extrai vigência
    const vigenciaMatch = block.match(/Vigência:?\s*([^<]+)/i);
    const vigencia = vigenciaMatch ? cleanHtml(vigenciaMatch[1]) : 'Vigente';

    // Extrai link
    const linkMatch = block.match(/href="([^"]*\.pdf[^"]*)"/i);
    const linkArquivo = linkMatch ? normalizeUrl(linkMatch[1]) : undefined;

    pareceres.push({
      numero,
      ano,
      tipo,
      assunto,
      ementa,
      vigencia,
      linkArquivo,
    });
  }

  // Padrão 2: Tabela com dados
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rowMatches = [...cleanedHtml.matchAll(tableRowPattern)];

  for (const match of rowMatches) {
    const row = match[1];

    // Extrai células
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 3) continue;

    const cell0 = cleanHtml(cells[0][1]);
    const cell1 = cleanHtml(cells[1][1]);
    const cell2 = cleanHtml(cells[2][1]);

    // Tenta extrair número/ano da primeira célula
    const numeroMatch = cell0.match(/(\d+)[\/\-](\d{4})/);
    if (!numeroMatch) continue;

    pareceres.push({
      numero: numeroMatch[1],
      ano: numeroMatch[2],
      tipo: cell1 || 'Manifestação',
      assunto: cell2 || '',
      ementa: cell2 || '',
      vigencia: 'Vigente',
    });
  }

  return pareceres;
}

/**
 * FUNÇÃO PARA USO COM PLAYWRIGHT MCP
 *
 * Esta função seria executada via Playwright MCP quando disponível.
 * Deixo aqui como referência para implementação futura.
 *
 * ESTRUTURA ESPERADA DO DECOR:
 * - Sistema carrega dados via JavaScript (função CarregaDados())
 * - Dados vêm de API interna (siscon-dev2.agu.gov.br ou similar)
 * - Estrutura: tabela ou cards com manifestações
 * - Paginação: 10 itens por página
 * - Filtros: por ano, tipo, câmara temática
 */
/*
async function scrapeParecerCONUNIWithPlaywright(): Promise<ParecerCONUNIRaw[]> {
  // Pseudo-código para quando Playwright estiver disponível via código:

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cgu.agu.gov.br/decor/');

  // Aguarda JavaScript carregar os pareceres
  await page.waitForSelector('.manifestacao-item', { timeout: 10000 });

  // Extrai pareceres
  const pareceres = await page.$$eval('.manifestacao-item', items =>
    items.map(item => ({
      numero: item.querySelector('.numero')?.textContent || '',
      ano: item.querySelector('.ano')?.textContent || '',
      tipo: item.querySelector('.tipo')?.textContent || '',
      assunto: item.querySelector('.assunto')?.textContent || '',
      ementa: item.querySelector('.ementa')?.textContent || '',
      vigencia: item.querySelector('.vigencia')?.textContent || 'Vigente',
      linkArquivo: item.querySelector('a[href*=".pdf"]')?.href || '',
    }))
  );

  // Percorre paginação se existir
  let hasNextPage = true;
  let currentPage = 1;

  while (hasNextPage) {
    const nextButton = await page.$('.pagination .next');
    if (nextButton && await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForSelector('.manifestacao-item', { timeout: 5000 });
      currentPage++;

      // Extrai mais pareceres...
    } else {
      hasNextPage = false;
    }
  }

  await browser.close();
  return pareceres;
}
*/
