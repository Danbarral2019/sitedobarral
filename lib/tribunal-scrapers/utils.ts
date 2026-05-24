/**
 * Tribunal Scrapers - Utilitarios Compartilhados
 *
 * Funcoes de fetch com retry, rate limiting, parsing HTML,
 * normalizacao de numeros de decisoes e logging de health.
 */

import * as cheerio from 'cheerio';
import { prisma } from '@/lib/prisma';
import { apiLogger } from "@/lib/logger";

// ===========================
// Sleep
// ===========================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================
// Fetch com retry exponencial
// ===========================

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 30000, maxRetries = 3, headers = {} } = options;
  const delays = [1000, 2000, 4000, 8000];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      // Retry on 429 (rate limit) or 5xx
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        if (attempt < maxRetries - 1) {
          await sleep(delays[attempt] || 8000);
          continue;
        }
      }

      // Non-retryable error
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        await sleep(delays[attempt] || 8000);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// ===========================
// Rate-limited fetch
// ===========================

export async function rateLimitedFetch(
  url: string,
  options: FetchOptions = {},
  delayMs = 2000
): Promise<Response> {
  await sleep(delayMs);
  return fetchWithRetry(url, options);
}

// ===========================
// HTML text extraction
// ===========================

export function extractTextFromHTML(html: string): string {
  // Replace <br>, <br/>, <br /> with newlines before parsing
  const preprocessed = html.replace(/<br\s*\/?>/gi, '\n');

  const $ = cheerio.load(preprocessed);

  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, noscript').remove();

  // Get text — use body first, fallback to root for HTML fragments without body
  let text = $('body').text();
  if (!text.trim()) {
    text = $.root().text();
  }

  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ===========================
// Decision number normalization
// ===========================

export function normalizeDecisionNumber(raw: string): string {
  // Remove "Acordao", "Decisao", etc. prefix
  let cleaned = raw
    .replace(/^(ac[oó]rd[aã]o|decis[aã]o|parecer\s+pr[eé]vio|s[uú]mula)\s*/i, '')
    .trim();

  // Remove "n." or "no" prefix
  cleaned = cleaned.replace(/^n[.ºo°]\s*/i, '').trim();

  // Normalize: remove dots from thousands (1.234 -> 1234) but keep /year
  cleaned = cleaned.replace(/(\d)\.(\d{3})/g, '$1$2');

  return cleaned;
}

// ===========================
// Tribunal code normalization
// ===========================

/**
 * Forma canônica do `tribunalCode` persistido em TribunalDecision: UPPERCASE.
 *
 * Esta é a ÚNICA autoridade de normalização. Os scrapers definem seu `code`
 * em lowercase (chave do registry / `canHandle`), mas TUDO que é gravado no
 * banco — e consumido por API pública (z.enum), branding e clipping — usa
 * MAIÚSCULO. Aplicar no ponto de escrita evita o split de case recorrente
 * que uma migração pontual (`scripts/normalize-tribunal-codes.ts`) não resolve.
 */
export function normalizeTribunalCode(code: string): string {
  return code.trim().toUpperCase();
}

// ===========================
// Full identifier builder
// ===========================

export function buildFullIdentifier(
  tribunalCode: string,
  decisionType: string,
  decisionNumber: string
): string {
  const typeMap: Record<string, string> = {
    acordao: 'Acordao',
    decisao: 'Decisao',
    parecer_previo: 'Parecer Previo',
    prejulgado: 'Prejulgado',
    sumula: 'Sumula',
  };

  const typeName = typeMap[decisionType] || decisionType;
  const normalized = normalizeDecisionNumber(decisionNumber);
  return `${normalizeTribunalCode(tribunalCode)} ${typeName} ${normalized}`;
}

// ===========================
// Year extraction
// ===========================

export function extractYear(text: string): number {
  // Try to extract year from "1234/2024" format
  const slashMatch = text.match(/\/(\d{4})/);
  if (slashMatch) return parseInt(slashMatch[1], 10);

  // Try standalone 4-digit year (2000-2099)
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) return parseInt(yearMatch[1], 10);

  return new Date().getFullYear();
}

// ===========================
// Date parsing (BR format)
// ===========================

export function parseBRDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// ===========================
// Scraper health logging
// ===========================

export async function logScraperHealth(
  scraperCode: string,
  status: 'success' | 'partial_failure' | 'failure',
  stats: {
    itemsFound?: number;
    itemsNew?: number;
    itemsError?: number;
    duration: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await prisma.scraperHealthLog.create({
      data: {
        scraperCode,
        status,
        itemsFound: stats.itemsFound ?? 0,
        itemsNew: stats.itemsNew ?? 0,
        itemsError: stats.itemsError ?? 0,
        duration: stats.duration,
        errorMessage: stats.errorMessage || null,
        metadata: stats.metadata ? JSON.stringify(stats.metadata) : null,
      },
    });
  } catch (error) {
    // Don't let health logging break the scraper
    apiLogger.error({ err: error }, `[${scraperCode}] Failed to log health:`);
  }
}

// ===========================
// Default search terms for licitacoes/contratos
// ===========================

export const DEFAULT_SEARCH_TERMS = [
  'licitacao',
  'contrato administrativo',
  'lei 14.133',
  'pregao eletronico',
  'dispensa de licitacao',
  'inexigibilidade',
  'registro de precos',
];
