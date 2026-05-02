/**
 * Identifica resumos problemáticos e limpa o campo `summary` em aiClassification
 * pra que o summarize-conuni-gemini.ts os reprocesse com o prompt refinado.
 *
 * Critérios "problemático":
 * - Começa com palavras vagas ("A manifestação...", "Esta nota...", etc.)
 * - Contém HTML entities (&iacute;, &ccedil;, &eacute;, etc.)
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/refresh-bad-summaries.ts             # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/refresh-bad-summaries.ts --apply
 */

import { prisma } from '../lib/prisma';

const APPLY = process.argv.includes('--apply');

const BAD_PATTERNS = [
  { name: 'comeca-vago', re: /^(trata-se|trata se|o presente|este parecer|esta nota|esta manifesta|a manifestaç|a presente|a aGU\b|a norma\b|a consulta)/i },
  { name: 'autoreferencia', re: /\b(o presente parecer|este parecer (?:trata|orienta|aborda|define))\b/i },
  { name: 'html-entity', re: /&(iacute|ccedil|eacute|aacute|atilde|otilde|oacute|uacute|nbsp|amp|quot);/i },
];

interface Doc { id: string; title: string; aiClassification: string; }

async function main() {
  const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';
  console.log(`${tag} Refresh de resumos problemáticos\n`);

  const docs = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      aiClassification: { contains: '"summary"' },
    },
    select: { id: true, title: true, aiClassification: true },
  }) as Doc[];

  const bad: Array<{ id: string; title: string; flags: string[]; oldSummary: string }> = [];

  for (const d of docs) {
    let ai: { summary?: string };
    try { ai = JSON.parse(d.aiClassification); } catch { continue; }
    const summary = (ai.summary || '').trim();
    if (!summary) continue;

    const flags = BAD_PATTERNS.filter(p => p.re.test(summary)).map(p => p.name);
    if (flags.length > 0) {
      bad.push({ id: d.id, title: d.title.slice(0, 90), flags, oldSummary: summary });
    }
  }

  console.log(`Total scanned: ${docs.length}`);
  console.log(`Problemáticos: ${bad.length}\n`);

  const byFlag: Record<string, number> = {};
  bad.forEach(b => b.flags.forEach(f => { byFlag[f] = (byFlag[f] || 0) + 1; }));
  console.log('Por flag:');
  Object.entries(byFlag).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\nAmostra (5):');
  bad.slice(0, 5).forEach(b => {
    console.log(`  [${b.flags.join(',')}] ${b.title}`);
    console.log(`    "${b.oldSummary.slice(0, 200)}..."`);
  });

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Use --apply pra limpar summary dos ${bad.length} docs e permitir reprocessamento.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nLimpando summary de ${bad.length} docs...`);
  let updated = 0;
  for (const b of bad) {
    try {
      const ai = JSON.parse(docs.find(d => d.id === b.id)!.aiClassification) as Record<string, unknown>;
      delete ai.summary;
      delete ai.summaryGeneratedAt;
      delete ai.summaryBy;
      await prisma.document.update({
        where: { id: b.id },
        data: { aiClassification: JSON.stringify(ai) },
      });
      updated++;
    } catch (e) {
      console.error(`  ✗ ${b.title}: ${(e as Error).message}`);
    }
  }
  console.log(`✓ ${updated} resumos removidos. Rode summarize-conuni-gemini.ts --apply pra regenerar com o prompt novo.`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
