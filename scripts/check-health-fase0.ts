/**
 * Fase 0.1 — Sanidade pós-férias (READ-ONLY).
 * Verifica saúde dos scrapers (ScraperHealthLog) e envios de newsletter
 * (NewsletterSend) nos últimos ~20 dias. Não escreve nada.
 *
 * Uso: npx tsx scripts/check-health-fase0.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../lib/prisma';

async function main() {
  const now = new Date();
  const since = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

  console.log(`\n=== SANIDADE FASE 0.1 — janela: últimos 20 dias (desde ${since.toISOString().slice(0, 10)}) ===\n`);

  // 1) Scrapers: última execução + status por scraperCode
  const logs = await prisma.scraperHealthLog.findMany({
    where: { runAt: { gte: since } },
    orderBy: { runAt: 'desc' },
    select: { scraperCode: true, status: true, itemsNew: true, itemsError: true, errorMessage: true, runAt: true },
  });

  const byScraper = new Map<string, { last: Date; lastStatus: string; runs: number; fails: number; lastError?: string | null }>();
  for (const l of logs) {
    const cur = byScraper.get(l.scraperCode);
    if (!cur) {
      byScraper.set(l.scraperCode, {
        last: l.runAt, lastStatus: l.status, runs: 1,
        fails: l.status === 'failure' ? 1 : 0,
        lastError: l.status !== 'success' ? l.errorMessage : null,
      });
    } else {
      cur.runs++;
      if (l.status === 'failure') cur.fails++;
    }
  }

  console.log('--- SCRAPERS (por código) ---');
  if (byScraper.size === 0) {
    console.log('⚠️  NENHUM registro de scraper nos últimos 20 dias — crons podem estar parados.');
  } else {
    const rows = [...byScraper.entries()].sort((a, b) => b[1].last.getTime() - a[1].last.getTime());
    for (const [code, s] of rows) {
      const daysAgo = ((now.getTime() - s.last.getTime()) / (24 * 60 * 60 * 1000)).toFixed(1);
      const flag = s.lastStatus === 'success' ? '✅' : s.lastStatus === 'partial_failure' ? '🟡' : '🔴';
      console.log(`${flag} ${code.padEnd(28)} última: ${s.last.toISOString().slice(0, 16)} (${daysAgo}d atrás) | runs:${s.runs} fails:${s.fails} | ${s.lastStatus}`);
      if (s.lastError) console.log(`     ↳ erro: ${String(s.lastError).slice(0, 160)}`);
    }
  }

  // 2) Newsletter: envios recentes (mensal de julho saiu?)
  const sends = await prisma.newsletterSend.findMany({
    where: { sentAt: { gte: since } },
    orderBy: { sentAt: 'desc' },
    select: { type: true, subject: true, sentAt: true, totalSent: true, totalFailed: true },
  });

  console.log('\n--- NEWSLETTER (últimos 20 dias) ---');
  if (sends.length === 0) {
    console.log('⚠️  Nenhum envio de newsletter registrado nos últimos 20 dias.');
  } else {
    for (const s of sends) {
      const flag = s.totalFailed > s.totalSent * 0.1 ? '🔴' : '✅';
      console.log(`${flag} [${s.type}] ${s.sentAt.toISOString().slice(0, 16)} | enviados:${s.totalSent} falhas:${s.totalFailed} | ${String(s.subject).slice(0, 60)}`);
    }
  }

  console.log('\n=== fim ===\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Erro:', e); process.exit(1); });
