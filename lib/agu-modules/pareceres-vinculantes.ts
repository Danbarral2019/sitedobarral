/**
 * AGU Scraper v4 - Módulo de Pareceres Vinculantes
 *
 * Scraping de pareceres vinculantes usando Playwright MCP
 * (conteúdo carregado via JavaScript)
 *
 * URL: https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes
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
import { apiLogger } from "@/lib/logger";
import { fetchWithRetry } from '../tribunal-scrapers/utils';

/**
 * Interface para dados brutos de um Parecer Vinculante extraído do HTML
 */
interface ParecerVinculanteRaw {
  numero: string;
  ano: string;
  assunto: string;
  ementa: string;
  linkPDF?: string;
  linkHTML?: string;
}

/**
 * Scrape Pareceres Vinculantes usando Playwright MCP
 *
 * IMPORTANTE: Esta função requer Playwright MCP instalado
 * pois a página carrega pareceres via JavaScript.
 *
 * Como usar:
 * 1. Certifique-se que Playwright MCP está instalado (`claude mcp list`)
 * 2. Use via Claude Code CLI: "Use Playwright para scrape pareceres da AGU"
 * 3. Ou aguarde integração direta de Playwright no código
 */
export async function scrapeParecerVinculante(
  config: AGUScraperConfig
): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('[AGU Pareceres] Iniciando scraping de Pareceres Vinculantes...');
  console.log('[AGU Pareceres] ⚠️ Página requer Playwright MCP (JavaScript dinâmico)');

  try {
    // OPÇÃO 1: Usar Playwright MCP via Claude Code
    // (ideal quando disponível)
    warnings.push('Playwright MCP recomendado - use via Claude Code CLI');
    warnings.push('Comando: "Use Playwright para navegar até https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes e extrair pareceres"');

    // OPÇÃO 2: Fallback com fetch HTTP
    // (limitado - pode não pegar conteúdo JavaScript)
    console.log('[AGU Pareceres] Tentando fallback com fetch HTTP...');

    const response = await fetchWithRetry('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('[AGU Pareceres] HTML carregado (pode estar vazio se usar JS)');

    // Tenta parsear (provavelmente não encontrará nada)
    const pareceresRaw = parseParecerFromHTML(html);
    console.log(`[AGU Pareceres] ${pareceresRaw.length} pareceres encontrados (fallback)`);

    if (pareceresRaw.length === 0) {
      warnings.push('Nenhum parecer encontrado - página provavelmente usa JavaScript');
      warnings.push('Use Playwright MCP para resultados completos');
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

      // Sugere cursos
      const cursosIds = suggestCursos(parecerRaw.assunto, textoCompleto);

      // Extrai número numérico
      const numeroMatch = parecerRaw.numero.match(/\d+/);
      const numeroInt = numeroMatch ? parseInt(numeroMatch[0]) : undefined;

      // Extrai tags
      const tags = extractTags(textoCompleto, ['AGU', 'Parecer Vinculante', parecerRaw.numero]);

      // URL principal
      const url = parecerRaw.linkPDF || parecerRaw.linkHTML || 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes';
      const urlPDF = parecerRaw.linkPDF;

      const documento: AGUDocument = {
        tipo: 'parecer-vinculante',
        numero: parecerRaw.numero,
        ano: ano,
        numeroInt: numeroInt,
        titulo: truncate(`Parecer Vinculante AGU nº ${numeroInt}/${ano}`, 200),
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

    console.log(`[AGU Pareceres] ✅ Scraping concluído em ${executionTime}ms`);
    console.log(`[AGU Pareceres] Total: ${documentos.length} | Relevantes: ${documentos.filter(d => d.isRelevante).length}`);

    return {
      success: pareceresRaw.length > 0,
      tipo: 'parecer-vinculante',
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
    apiLogger.error({ err: errorMsg }, '[AGU Pareceres] ❌ Erro:');

    return {
      success: false,
      tipo: 'parecer-vinculante',
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
 * Parse HTML para extrair Pareceres Vinculantes
 *
 * NOTA: Esta função pode retornar array vazio se a página
 * carregar pareceres via JavaScript (que é o caso).
 *
 * Para scraping completo, use Playwright MCP.
 */
function parseParecerFromHTML(html: string): ParecerVinculanteRaw[] {
  const pareceres: ParecerVinculanteRaw[] = [];

  // Limpa HTML
  const cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Tenta encontrar pareceres no HTML estático
  // (provavelmente não funcionará se usar JavaScript)

  // Padrão 1: Links para PDFs de pareceres
  const pdfPattern = /href="([^"]*parecer[^"]*\.pdf[^"]*)"/gi;
  const pdfMatches = [...cleanedHtml.matchAll(pdfPattern)];

  for (const match of pdfMatches) {
    const linkPDF = normalizeUrl(match[1]);

    // Tenta extrair número do nome do arquivo
    const nomeArquivo = linkPDF.split('/').pop() || '';
    const numeroMatch = nomeArquivo.match(/(\d+)[_-](\d{4})/); // Ex: parecer_123_2024.pdf

    if (numeroMatch) {
      const numero = numeroMatch[1];
      const ano = numeroMatch[2];

      pareceres.push({
        numero: `Parecer ${numero}`,
        ano,
        assunto: 'Parecer Vinculante AGU',
        ementa: `Parecer Vinculante nº ${numero}/${ano}`,
        linkPDF,
      });
    }
  }

  // Padrão 2: Estrutura de lista (se existir no HTML estático)
  // Exemplo: <div class="parecer-item">
  const parecerItemPattern = /<div[^>]*class="[^"]*parecer[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const itemMatches = [...cleanedHtml.matchAll(parecerItemPattern)];

  for (const match of itemMatches) {
    const block = match[1];

    // Extrai número
    const numeroMatch = block.match(/(?:Parecer|Nº)\s*(\d+)[\/\-](\d{4})/i);
    if (!numeroMatch) continue;

    const numero = numeroMatch[1];
    const ano = numeroMatch[2];

    // Extrai assunto/título
    const assuntoMatch = block.match(/<h[^>]*>(.*?)<\/h\d>/i);
    const assunto = assuntoMatch
      ? cleanHtml(assuntoMatch[1])
      : 'Parecer Vinculante AGU';

    // Extrai link PDF
    const pdfMatch = block.match(/href="([^"]*\.pdf[^"]*)"/i);
    const linkPDF = pdfMatch ? normalizeUrl(pdfMatch[1]) : undefined;

    pareceres.push({
      numero: `Parecer ${numero}`,
      ano,
      assunto,
      ementa: assunto,
      linkPDF,
    });
  }

  return pareceres;
}

/**
 * FUNÇÃO PARA USO COM PLAYWRIGHT MCP
 *
 * Esta função seria executada via Playwright MCP quando disponível.
 * Deixo aqui como referência para implementação futura.
 */
/*
async function scrapeParecerWithPlaywright(): Promise<ParecerVinculanteRaw[]> {
  // Pseudo-código para quando Playwright estiver disponível via código:

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/pareceresvinculantes');

  // Aguarda JavaScript carregar os pareceres
  await page.waitForSelector('.parecer-item', { timeout: 10000 });

  // Extrai pareceres
  const pareceres = await page.$$eval('.parecer-item', items =>
    items.map(item => ({
      numero: item.querySelector('.numero')?.textContent || '',
      ano: item.querySelector('.ano')?.textContent || '',
      assunto: item.querySelector('.assunto')?.textContent || '',
      ementa: item.querySelector('.ementa')?.textContent || '',
      linkPDF: item.querySelector('a[href*=".pdf"]')?.href || '',
    }))
  );

  await browser.close();
  return pareceres;
}
*/
