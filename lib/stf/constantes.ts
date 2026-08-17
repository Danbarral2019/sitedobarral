/**
 * Constantes do fluxo de ingestão do STF.
 *
 * Vivem fora de `app/api/ingest/stf/route.ts` porque o App Router do Next.js
 * só aceita, num arquivo de rota, os handlers HTTP (`GET`, `POST`, ...) e um
 * conjunto fechado de configs (`runtime`, `maxDuration`, `dynamic`, etc.) —
 * qualquer outro `export` quebra o `next build` com "does not match the
 * required types of a Next.js Route".
 */

/**
 * Código de saúde do fluxo do STF. Distinto dos scrapers do registry porque a
 * coleta acontece FORA da Vercel — num job do GitHub Actions com navegador
 * real, única via que vence o desafio JavaScript do AWS WAF do portal. O cron
 * `tribunal-scraper-health` lê este log como lê o dos demais, agregado por
 * `scraperCode` em `ScraperHealthLog`.
 */
export const SCRAPER_CODE_STF = 'stf-runner';
