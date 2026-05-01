/**
 * Audit dos Decretos no banco. Baseado em scripts/audit-ins-from-db.ts.
 * Roda validateActContent em cada decreto e gera relatório base.
 */
import { prisma } from '../lib/prisma';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface AuditEntry {
  id: string;
  fullNumber: string;
  number: string;
  year: number;
  title: string;
  issuer: string;
  officialUrl: string | null;
  contentLength: number;
  publishDate: string;
  validation: { errors: string[]; warnings: string[]; ok: boolean };
}

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: {
      OR: [{ type: 'decreto' }, { fullNumber: { startsWith: 'Decreto' } }],
    },
    orderBy: [{ year: 'desc' }, { number: 'desc' }],
  });

  console.log(`📋 Encontrados ${acts.length} decretos no banco.\n`);

  const entries: AuditEntry[] = [];
  let okCount = 0;
  let errorCount = 0;
  let warningCount = 0;

  for (const act of acts) {
    const validation = validateActContent({ url: act.officialUrl, content: act.content });
    entries.push({
      id: act.id,
      fullNumber: act.fullNumber,
      number: act.number,
      year: act.year,
      title: act.title,
      issuer: act.issuer,
      officialUrl: act.officialUrl,
      contentLength: act.content?.length ?? 0,
      publishDate: act.publishDate.toISOString().slice(0, 10),
      validation,
    });
    if (validation.ok && validation.warnings.length === 0) okCount++;
    if (!validation.ok) errorCount++;
    if (validation.warnings.length > 0) warningCount++;
  }

  console.log(`📊 Resumo:`);
  console.log(`   Total decretos: ${acts.length}`);
  console.log(`   ✅ OK:          ${okCount}`);
  console.log(`   ❌ Errors:      ${errorCount}`);
  console.log(`   ⚠️  Warnings:   ${warningCount}\n`);

  const errored = entries.filter((e) => !e.validation.ok);
  if (errored.length) {
    console.log('🚫 Decretos com ERRO:');
    for (const e of errored) {
      console.log(`\n   ${e.fullNumber} (${e.contentLength} chars)`);
      console.log(`   URL: ${e.officialUrl ?? '(sem URL)'}`);
      for (const err of e.validation.errors) console.log(`   ❌ ${err}`);
      for (const w of e.validation.warnings) console.log(`   ⚠️  ${w}`);
    }
  }

  const warned = entries.filter((e) => e.validation.ok && e.validation.warnings.length > 0);
  if (warned.length) {
    console.log(`\n⚠️  Decretos com warnings (${warned.length}):`);
    for (const e of warned) {
      console.log(`   ${e.fullNumber} (${e.contentLength} chars): ${e.validation.warnings.map((w) => w.slice(0, 80)).join('; ')}`);
    }
  }

  console.log('\n📄 Lista completa:');
  for (const e of entries) {
    const flag = !e.validation.ok ? '❌' : e.validation.warnings.length > 0 ? '⚠️' : '✅';
    const numTrim = e.number.length > 8 ? e.number.slice(0, 7) + '…' : e.number;
    console.log(`   ${flag} Decreto ${numTrim}/${e.year} — ${e.contentLength} chars — ${e.title.slice(0, 60)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outFile = join(process.cwd(), 'docs', 'audits', `${today}-decretos-audit-db.json`);
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), summary: { total: acts.length, ok: okCount, errors: errorCount, warnings: warningCount }, entries }, null, 2));
  console.log(`\n💾 Salvo: ${outFile}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
