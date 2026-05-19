/**
 * AGU Scraper v4 - Módulo de Súmulas AGU
 *
 * Scraping de súmulas da AGU usando fetch HTTP (conteúdo estático)
 * URL: https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula
 */

import type { AGUDocument, AGUScraperConfig, AGUScraperResult } from '../agu-types';
import {
  analyzeRelevancia,
  suggestCursos,
  cleanHtml,
  truncate,
  extractTags,
} from './helpers';
import { apiLogger } from "@/lib/logger";
import { fetchWithRetry } from '../tribunal-scrapers/utils';

/**
 * Interface para dados brutos de uma Súmula extraída do HTML
 */
interface SumulaRaw {
  numero: string;
  data: string;
  enunciado: string;
  referencias: string;
  jurisprudencia?: string;
  status?: string; // "Revogada", "Alterada", etc.
}

/**
 * Scrape Súmulas AGU usando fetch HTTP
 *
 * As súmulas estão carregadas estaticamente no HTML, então
 * não é necessário usar Playwright MCP.
 */
export async function scrapeSumulas(
  config: AGUScraperConfig
): Promise<AGUScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('[AGU Súmulas] Iniciando scraping de Súmulas AGU...');

  try {
    const response = await fetchWithRetry('https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('[AGU Súmulas] HTML carregado, parseando...');

    // Parse HTML para extrair Súmulas
    const sumulasRaw = parseSumulasFromHTML(html);
    console.log(`[AGU Súmulas] ${sumulasRaw.length} súmulas encontradas`);

    // Converte para formato AGUDocument
    const documentos: AGUDocument[] = [];

    for (const sumulaRaw of sumulasRaw) {
      // Extrai ano da data
      const anoMatch = sumulaRaw.data.match(/\d{4}/);
      const ano = anoMatch ? parseInt(anoMatch[0]) : undefined;

      // Filtra por ano se configurado
      if (config.anoInicio && ano && ano < config.anoInicio) continue;
      if (config.anoFim && ano && ano > config.anoFim) continue;

      // Analisa relevância
      const textoCompleto = `${sumulaRaw.enunciado} ${sumulaRaw.referencias}`;
      const { isRelevante, score, temas } = analyzeRelevancia(sumulaRaw.enunciado, textoCompleto);

      // Filtra por relevância se configurado
      if (config.filtroRelevancia && !isRelevante) continue;

      // Sugere cursos
      const cursosIds = suggestCursos(sumulaRaw.enunciado, textoCompleto);

      // Extrai número numérico
      const numeroMatch = sumulaRaw.numero.match(/\d+/);
      const numeroInt = numeroMatch ? parseInt(numeroMatch[0]) : undefined;

      // Extrai tags
      const tags = extractTags(textoCompleto, ['AGU', 'Súmula', sumulaRaw.numero]);

      // Adiciona status como tag se existir
      if (sumulaRaw.status) {
        tags.push(sumulaRaw.status);
      }

      const documento: AGUDocument = {
        tipo: 'sumula',
        numero: sumulaRaw.numero,
        ano: ano,
        numeroInt: numeroInt,
        titulo: truncate(`Súmula AGU nº ${numeroInt}`, 200),
        descricao: truncate(sumulaRaw.enunciado, 1000),
        url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula',
        tags,
        dataPublicacao: sumulaRaw.data,
        isRelevante,
        relevanciaScore: score,
        temas,
        cursosIds,
      };

      documentos.push(documento);
    }

    const executionTime = Date.now() - startTime;

    console.log(`[AGU Súmulas] ✅ Scraping concluído em ${executionTime}ms`);
    console.log(`[AGU Súmulas] Total: ${documentos.length} | Relevantes: ${documentos.filter(d => d.isRelevante).length}`);

    return {
      success: true,
      tipo: 'sumula',
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
    apiLogger.error({ err: errorMsg }, '[AGU Súmulas] ❌ Erro:');

    return {
      success: false,
      tipo: 'sumula',
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
 * Parse HTML para extrair Súmulas
 *
 * Estrutura real da página:
 * <p class="dou-paragraph"><b><span>SÚMULA Nº 1, DE 27 DE JUNHO DE 1997</span></b></p>
 * <p class="dou-paragraph">Texto do enunciado...</p>
 * REFERÊNCIAS: ...
 * JURISPRUDÊNCIA: ...
 */
function parseSumulasFromHTML(html: string): SumulaRaw[] {
  const sumulas: SumulaRaw[] = [];

  // Limpa HTML
  const cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Padrão para encontrar súmulas
  // Exemplo: <b><span>SÚMULA Nº 1, DE 27 DE JUNHO DE 1997</span></b>
  const sumulaPattern = /<b><span>SÚMULA\s+Nº\s+(\d+),\s+DE\s+([^<]+)<\/span><\/b>/gi;

  const matches = [...cleanedHtml.matchAll(sumulaPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const numero = match[1];
    const data = match[2].trim();
    const matchPosition = match.index || 0;

    // Extrai bloco de conteúdo dessa súmula
    const nextSumulaPosition = i < matches.length - 1
      ? (matches[i + 1].index || cleanedHtml.length)
      : cleanedHtml.length;

    const block = cleanedHtml.slice(matchPosition, nextSumulaPosition);

    // Extrai enunciado
    // Formato:
    // 1. Linha com data: <p>Publicada no DOU...</p>
    // 2. Linha com enunciado: <p>"Texto da súmula..."</p> OU <p>(*) Revogada...</p>
    // 3. REFERÊNCIAS ou próxima súmula

    let enunciado = '';

    // Pula linha da data de publicação e pega próxima(s) linha(s)
    const contentAfterHeader = block.substring(block.indexOf('</b></p>'));
    const paragraphs = contentAfterHeader.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];

    // Pega parágrafos até encontrar REFERÊNCIAS ou próxima súmula
    for (const p of paragraphs.slice(1)) { // Slice(1) para pular a linha da data
      const text = p
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text || text.length < 5) continue;
      if (text.match(/^REFERÊNCIAS/i)) break;
      if (text.match(/^JURISPRUDÊNCIA/i)) break;
      if (text.match(/^SÚMULA/i)) break;

      enunciado += (enunciado ? ' ' : '') + text;

      // Para quando achar texto razoável (evita pegar refs como enunciado)
      if (enunciado.length > 50 && text.includes('.')) break;
    }

    enunciado = enunciado.trim();

    // Extrai referências
    const referenciasMatch = block.match(/REFERÊNCIAS:?\s*([\s\S]+?)(?:JURISPRUDÊNCIA|SÚMULA|<b><span>|$)/i);
    const referencias = referenciasMatch
      ? cleanHtml(referenciasMatch[1])
          .replace(/<\/?[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    // Extrai jurisprudência (opcional)
    const jurisprudenciaMatch = block.match(/JURISPRUDÊNCIA:?\s*([\s\S]+?)(?:SÚMULA|<b><span>|$)/i);
    const jurisprudencia = jurisprudenciaMatch
      ? cleanHtml(jurisprudenciaMatch[1])
          .replace(/<\/?[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : undefined;

    // Detecta status (Revogada, Alterada, etc.)
    let status: string | undefined;
    if (block.match(/revogad[ao]/i)) {
      status = 'Revogada';
    } else if (block.match(/alterad[ao]/i)) {
      status = 'Alterada';
    } else if (block.match(/cancelad[ao]/i)) {
      status = 'Cancelada';
    }

    // Valida que tem conteúdo mínimo
    if (enunciado.length < 10) {
      console.warn(`[AGU Súmulas] ⚠️ Súmula ${numero} com enunciado muito curto, pulando`);
      continue;
    }

    sumulas.push({
      numero: `Súmula ${numero}`,
      data,
      enunciado,
      referencias,
      jurisprudencia,
      status,
    });
  }

  // Ordena por número
  sumulas.sort((a, b) => {
    const numA = parseInt(a.numero.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.numero.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  return sumulas;
}
