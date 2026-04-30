/**
 * apply-ons-dou-urls.ts
 *
 * Leva 2 — aplica URLs DOU específicas no DB.
 *
 * Lê docs/audits/2026-04-30-ons-dou-urls.json (gerado por scrape-ons-douurls.ts).
 * Para cada ON: substitui Document.url pelo URL DOU específico, e move a URL
 * antiga (PDF de fundamentação) para alternativeUrls.
 *
 * Sem --apply: dry-run
 * Com --apply: escreve no DB
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/apply-ons-dou-urls.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/apply-ons-dou-urls.ts --apply
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface DouEntry {
  numero: number;
  url: string;
  hasAguPrefix: boolean;
  douDate?: string;
}

const MES_TO_NUM: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function parseDouDate(douDate?: string): { year: number; month: number; day: number } | null {
  if (!douDate) return null;
  const m = douDate.match(/(\d+)\/([a-zç]+)\/(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MES_TO_NUM[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (!month) return null;
  return { year, month, day };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const today = new Date().toISOString().slice(0, 10);
  const inputPath = path.join(process.cwd(), 'docs', 'audits', `${today}-ons-dou-urls.json`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input não encontrado: ${inputPath}`);
    console.error('Rode primeiro: npx tsx scripts/scrape-ons-douurls.ts');
    process.exit(1);
  }

  const { entries } = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as {
    entries: DouEntry[];
  };

  console.log('='.repeat(60));
  console.log(`APPLY-ONS-DOU-URLS — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(`Entradas no JSON: ${entries.length}\n`);

  type Plan = {
    numero: number;
    ano?: number;
    dbId?: string;
    urlAntiga?: string;
    urlNovaDOU: string;
    alternativeUrlsAntigas?: string;
    alternativeUrlsNovas?: string;
    skip?: string;
  };

  const plans: Plan[] = [];

  for (const e of entries) {
    const date = parseDouDate(e.douDate);
    const ano = date?.year;

    // Match no DB: por (onNumber, onYear)
    const where: Record<string, unknown> = { category: 'orientacao-normativa', onNumber: e.numero };
    if (ano) where.onYear = ano;

    const candidates = await prisma.document.findMany({
      where,
      select: { id: true, onNumber: true, onYear: true, url: true, alternativeUrls: true, isPublic: true },
    });

    if (candidates.length === 0) {
      plans.push({ numero: e.numero, ano, urlNovaDOU: e.url, skip: 'sem match no DB' });
      continue;
    }

    if (candidates.length > 1) {
      // Múltiplas ONs com mesmo numero/ano — escolhe a publicada
      const publicas = candidates.filter((c) => c.isPublic);
      if (publicas.length === 0) {
        plans.push({ numero: e.numero, ano, urlNovaDOU: e.url, skip: 'múltiplos matches mas nenhum público' });
        continue;
      }
      // Pega a primeira pública (TODO: refinar critério se necessário)
      const target = publicas[0];
      const altOld = target.alternativeUrls;
      let altNew: string | undefined;
      if (target.url && target.url !== e.url && !target.url.endsWith('/onsagu')) {
        // Salva URL antiga em alternativeUrls
        const existing = altOld ? JSON.parse(altOld) : [];
        const arr = Array.isArray(existing) ? existing : [];
        if (!arr.includes(target.url)) arr.push(target.url);
        altNew = JSON.stringify(arr);
      }
      plans.push({
        numero: e.numero,
        ano,
        dbId: target.id,
        urlAntiga: target.url,
        urlNovaDOU: e.url,
        alternativeUrlsAntigas: altOld || undefined,
        alternativeUrlsNovas: altNew,
      });
      continue;
    }

    const target = candidates[0];
    if (target.url === e.url) {
      plans.push({ numero: e.numero, ano, urlNovaDOU: e.url, skip: 'URL já está atualizada no DB' });
      continue;
    }

    const altOld = target.alternativeUrls;
    let altNew: string | undefined;
    if (target.url && !target.url.endsWith('/onsagu')) {
      const existing = altOld ? JSON.parse(altOld) : [];
      const arr = Array.isArray(existing) ? existing : [];
      if (!arr.includes(target.url)) arr.push(target.url);
      altNew = JSON.stringify(arr);
    }
    plans.push({
      numero: e.numero,
      ano,
      dbId: target.id,
      urlAntiga: target.url,
      urlNovaDOU: e.url,
      alternativeUrlsAntigas: altOld || undefined,
      alternativeUrlsNovas: altNew,
    });
  }

  const willApply = plans.filter((p) => !p.skip && p.dbId);
  const skipped = plans.filter((p) => p.skip);

  console.log('Plano:');
  console.log(`  ✅ Vão atualizar URL: ${willApply.length}`);
  console.log(`  ⏭️  Pulam: ${skipped.length}`);
  if (skipped.length > 0) {
    const motivos = new Map<string, number>();
    for (const s of skipped) motivos.set(s.skip!, (motivos.get(s.skip!) || 0) + 1);
    for (const [m, c] of motivos.entries()) console.log(`     • ${c}× ${m}`);
  }

  console.log('\nAmostra dos updates:');
  for (const p of willApply.slice(0, 5)) {
    console.log(`  ON ${p.numero}/${p.ano}:`);
    console.log(`    de: ${p.urlAntiga?.slice(0, 90)}`);
    console.log(`    p:  ${p.urlNovaDOU.slice(0, 90)}`);
  }

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/apply-ons-dou-urls.ts --apply');
    await prisma.$disconnect();
    return;
  }

  // APPLY
  console.log('\nAplicando no DB...');
  let success = 0;
  let errors = 0;
  const failures: Array<{ numero: number; ano?: number; error: string }> = [];

  for (const p of willApply) {
    if (!p.dbId) continue;
    try {
      await prisma.document.update({
        where: { id: p.dbId },
        data: {
          url: p.urlNovaDOU,
          alternativeUrls: p.alternativeUrlsNovas ?? p.alternativeUrlsAntigas,
          reviewed: false,
          reviewedAt: null,
        },
      });
      success++;
    } catch (e) {
      errors++;
      failures.push({
        numero: p.numero,
        ano: p.ano,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log(`\n✅ Atualizadas: ${success} | ❌ Falhas: ${errors}`);

  const logPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ons-dou-urls-apply-log.json`
  );
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      { appliedAt: new Date().toISOString(), total: willApply.length, success, errors, failures, plans },
      null,
      2
    )
  );
  console.log(`📄 Log: ${logPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
