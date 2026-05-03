/**
 * Lookback CLI: re-busca o DOU dos últimos N dias com os 15 termos do
 * Clipping v2, classifica via IA editorial e popula a fila admin.
 *
 * NÃO dispara email (volume potencial alto distrai). Dedup por
 * Document.douUrl, LegislativeAct.title, DOUStagingDocument.url.
 *
 * Uso:
 *   npx tsx scripts/dou-lookback.ts                  # default --days 60
 *   npx tsx scripts/dou-lookback.ts --days 30
 *   npx tsx scripts/dou-lookback.ts --days 60 --dry-run
 *
 * Spec: docs/superpowers/specs/2026-05-03-dou-clipping-v2-design.md
 */

import 'dotenv/config';
import { searchLastDays } from '../lib/dou-api';
import { isAtoNormativoGeral } from '../lib/dou-normative-filter';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import {
  classifyEditorialBatch,
  EDITORIAL_PROMPT_VERSION,
  type EditorialCandidate,
} from '../lib/dou-editorial-classifier';
import { prisma } from '../lib/prisma';

const SEARCH_TERMS_V2 = [
  'lei 14.133 OR lei 14133 OR nova lei de licitações',
  'decreto licitação OR decreto contratação',
  'instrução normativa SEGES OR instrução normativa MGI',
  'portaria normativa licitação OR portaria normativa contratação',
  'portaria SEGES OR portaria MGI',
  'instrução normativa CGU OR portaria CGU',
  'parecer AGU OR orientação normativa AGU',
  'portaria SECEX OR resolução TCU',
  'decreto servidor público federal',
  'decreto teletrabalho OR decreto jornada servidor',
  'decreto contratos administrativos federais',
  'decreto regime jurídico único',
  'decreto regulamenta lei 14.133',
  'reorganização administração federal contratações',
  'fundo de contratações OR centralização compras governo',
];

const BATCH_SIZE = 5;
const SCORE_FLOOR = 50;
const SCORE_THRESHOLD = 70;

function parseArgs(): { days: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  let days = 60;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days') days = parseInt(args[++i] || '60', 10);
    if (args[i] === '--dry-run') dryRun = true;
  }
  return { days, dryRun };
}

async function main() {
  const { days, dryRun } = parseArgs();
  console.log(`[lookback] dias=${days} dryRun=${dryRun} terms=${SEARCH_TERMS_V2.length}`);

  // 1. Buscar
  const all = new Map<string, Awaited<ReturnType<typeof searchLastDays>>[number]>();
  for (const term of SEARCH_TERMS_V2) {
    try {
      console.log(`[lookback] buscando "${term}"`);
      const r = await searchLastDays(term, days);
      for (const item of r) if (!all.has(item.href)) all.set(item.href, item);
      await new Promise((res) => setTimeout(res, 1500));
    } catch (e) {
      console.error(`[lookback] erro busca "${term}":`, e);
    }
  }
  const results = Array.from(all.values());
  console.log(`[lookback] ${results.length} resultados únicos`);

  // 2. Filtrar concretos + dedup
  const candidates: Array<{ raw: typeof results[number]; cleanTitle: string; cleanAbstract: string }> = [];
  let skippedConcreto = 0;
  let skippedDup = 0;

  for (const r of results) {
    const cleanTitle = r.title.replace(/<[^>]*>/g, '').trim();
    const cleanAbstract = normalizeScrapedText(r.abstract || '');
    if (isAtoNormativoGeral(cleanTitle, r.abstract) === 'concreto') {
      skippedConcreto++;
      continue;
    }
    const dup = await prisma.document.findFirst({
      where: { OR: [{ douUrl: r.href }, { title: { equals: cleanTitle, mode: 'insensitive' } }] },
      select: { id: true },
    });
    if (dup) { skippedDup++; continue; }
    const dupS = await prisma.dOUStagingDocument.findFirst({ where: { url: r.href }, select: { id: true } });
    if (dupS) { skippedDup++; continue; }
    const dupA = await prisma.legislativeAct.findFirst({
      where: { title: { equals: cleanTitle, mode: 'insensitive' } },
      select: { id: true },
    });
    if (dupA) { skippedDup++; continue; }

    candidates.push({ raw: r, cleanTitle, cleanAbstract });
  }
  console.log(`[lookback] candidatos pra IA: ${candidates.length} (concretos: ${skippedConcreto}, dups: ${skippedDup})`);

  // 3. Classificar IA + grava staging com source='lookback'
  let added = 0;
  let discarded = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    let cls;
    try {
      cls = await classifyEditorialBatch(
        batch.map((b): EditorialCandidate => ({
          title: b.cleanTitle,
          abstract: b.cleanAbstract,
          hierarchyStr: b.raw.hierarchyStr,
        })),
      );
    } catch (e) {
      console.error('[lookback] erro IA batch:', e);
      errors++;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const r = cls.classifications[j];

      if (r.score < SCORE_FLOOR) {
        discarded++;
        continue;
      }
      const isAmbiguous = r.score < SCORE_THRESHOLD || r.ambiguous;

      if (dryRun) {
        console.log(`[lookback] [DRY] score=${r.score}${isAmbiguous ? ' AMB' : ''} :: ${c.cleanTitle.substring(0, 80)}`);
        added++;
        continue;
      }

      try {
        await prisma.dOUStagingDocument.create({
          data: {
            douId: c.raw.id || c.raw.href,
            title: c.cleanTitle,
            abstract: c.raw.abstract || '',
            url: c.raw.href,
            section: c.raw.section || 'do1',
            publishDate: c.raw.date || new Date().toLocaleDateString('pt-BR'),
            hierarchyStr: c.raw.hierarchyStr,
            category: 'ato_normativo',
            approvalStatus: 'pending',
            confidence: r.score,
            reasoning: JSON.stringify([r.reason]),
            isRelevant: true,
            requiresReview: true,
            imported: false,
            editorialScore: r.score,
            editorialReason: r.reason,
            editorialSummary: r.summary,
            editorialAffects: JSON.stringify(r.affects),
            editorialActType: r.actType,
            editorialAmbiguous: isAmbiguous,
            editorialModel: cls.model,
            editorialPromptVer: cls.promptVersion || EDITORIAL_PROMPT_VERSION,
            editorialClassifiedAt: new Date(),
            source: 'lookback',
          },
        });
        added++;
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') {
          // Race com cron concorrente
          discarded++;
        } else {
          console.error('[lookback] erro insert:', e);
          errors++;
        }
      }
    }

    await new Promise((res) => setTimeout(res, 1000));
  }

  console.log(`\n[lookback] ✅ Concluído.`);
  console.log(`  Adicionados: ${added}`);
  console.log(`  Descartados (score<${SCORE_FLOOR}): ${discarded}`);
  console.log(`  Erros: ${errors}`);
  console.log(`\nRevisar em: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin/clipping-dou?source=lookback`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
