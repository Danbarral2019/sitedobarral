/**
 * Saneamento dos atos normativos que entraram pelo clipping do DOU com
 * defeitos de cadastro:
 *
 *   1. Ementa = `abstract` da busca do DOU (epígrafe + ementa + preâmbulo +
 *      começo do art. 1º, truncado) ou só o título. Recorta a ementa oficial
 *      do texto integral (`content`); na falta dele, do próprio trecho, desde
 *      que o recorte termine no preâmbulo. Ementa alterada volta a
 *      `embeddingStatus = 'pending'` para o cron reindexar (a ementa compõe o
 *      primeiro trecho indexado).
 *   1b. Texto integral do DOU truncado no início (a versão antiga de
 *      `stripDouBoilerplate` cortava no primeiro "Lei" da ementa, perdendo
 *      epígrafe e verbo inicial). Esses atos não recebem ementa recortada do
 *      texto ruim: com --apply o texto é baixado de novo (`scrapeAndIndexAct`),
 *      que também troca a ementa e reindexa.
 *   1c. Texto do DOU cortado na citação de outro ato: a primeira linha é
 *      epígrafe, mas de outro número ("Portaria SEGES/MGI nº 9.510" no texto da
 *      Portaria 6.364/2026). Também baixado de novo.
 *   1d. Ato sem texto integral (download anterior falhou): baixado de novo.
 *   1e. Ato sem ementa oficial (epígrafe seguida do preâmbulo): o campo ementa
 *      guarda a identificação do ato e a página omite o bloco. Não é pendência.
 *   2. Tipo `mp` → `medida-provisoria` e fullNumber "MP n/aaaa" → "Medida
 *      Provisória n/aaaa", igual ao cadastro manual. Se já existir ato com o
 *      fullNumber por extenso, o renome é pulado e reportado (duplicata a
 *      resolver à mão).
 *
 * Ementa já correta nunca é tocada (ver `looksLikeDefectiveEmenta`).
 *
 * Uso:
 *   npx tsx scripts/sanear-ementas-atos.ts            # dry-run: só relata
 *   npx tsx scripts/sanear-ementas-atos.ts --apply    # grava
 *   npx tsx scripts/sanear-ementas-atos.ts --id=<uuid>
 */
import { prisma } from '../lib/prisma';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import {
  extractEmenta,
  looksLikeDefectiveEmenta,
  startsWithEpigrafe,
  isIdentificacaoDoAto,
  epigrafeNumber,
} from '../lib/legislative-scrapers/extract-ementa';
import { scrapeAndIndexAct } from '../lib/legislative-scrapers/scrape-and-index';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { getHierarchyLevel } from '../lib/legislative-acts/hierarchy';
import { CacheInvalidation } from '../lib/cache/redis-client';

interface Fix {
  id: string;
  fullNumber: string;
  data: Record<string, unknown>;
  notes: string[];
  rescrape: boolean;
}

/**
 * Texto integral baixado do DOU truncado no download: não abre na epígrafe, ou
 * abre na epígrafe de outro ato (corte na citação "Portaria ... nº 9.510").
 */
function isTruncatedDouContent(act: {
  officialUrl: string | null;
  content: string | null;
  number: string | null;
}): boolean {
  if (!act.content || !act.officialUrl || !/in\.gov\.br/i.test(act.officialUrl)) return false;
  if (!startsWithEpigrafe(act.content)) return true;
  const n = epigrafeNumber(act.content);
  const own = (act.number ?? '').replace(/\D/g, '');
  return Boolean(n && own && n !== own);
}

/** Ato sem ementa oficial: o texto passa da epígrafe direto ao preâmbulo. */
function hasNoOfficialEmenta(act: { ementa: string; content: string | null }): boolean {
  return Boolean(
    act.content && startsWithEpigrafe(act.content) && !extractEmenta(act.content) && isIdentificacaoDoAto(act.ementa),
  );
}

function newEmentaFor(act: { title: string; ementa: string; content: string | null }): {
  ementa: string | null;
  motivo: string;
} {
  if (act.content) {
    const fromContent = extractEmenta(act.content);
    if (fromContent?.complete) {
      const ementa = normalizeScrapedText(fromContent.ementa);
      if (looksLikeDefectiveEmenta(ementa)) {
        return { ementa: null, motivo: `recorte ainda parece trecho do corpo: "${ementa.slice(0, 120)}"` };
      }
      const v = validateActContent({ content: act.content, ementa });
      const ementaErrors = v.errors.filter((e) => /ementa/i.test(e));
      if (ementaErrors.length === 0) return { ementa, motivo: 'recortada do texto integral' };
      return { ementa: null, motivo: `recorte reprovado: ${ementaErrors.join('; ')}` };
    }
  }
  const fromSnippet = extractEmenta(act.ementa);
  if (fromSnippet?.complete && !looksLikeDefectiveEmenta(normalizeScrapedText(fromSnippet.ementa))) {
    return { ementa: normalizeScrapedText(fromSnippet.ementa), motivo: 'recortada do trecho do DOU' };
  }
  return {
    ementa: null,
    motivo: act.content
      ? 'texto integral sem epígrafe/preâmbulo reconhecível'
      : 'sem texto integral e trecho do DOU truncado',
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];

  const acts = await prisma.legislativeAct.findMany({
    where: onlyId ? { id: onlyId } : {},
    select: {
      id: true,
      type: true,
      fullNumber: true,
      title: true,
      ementa: true,
      content: true,
      officialUrl: true,
      number: true,
      scrapeStatus: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const fullNumbers = new Set(acts.map((a) => a.fullNumber));
  if (onlyId) {
    const all = await prisma.legislativeAct.findMany({ select: { fullNumber: true } });
    all.forEach((a) => fullNumbers.add(a.fullNumber));
  }

  const fixes: Fix[] = [];
  const pendencias: string[] = [];
  const semEmenta: string[] = [];

  for (const act of acts) {
    const data: Record<string, unknown> = {};
    const notes: string[] = [];
    const truncated = isTruncatedDouContent(act);
    // `manual` = texto mantido à mão; o cron de atualização também o pula.
    const missingContent = !act.content && Boolean(act.officialUrl) && act.scrapeStatus !== 'manual';
    const rescrape = truncated || missingContent;

    if (truncated) {
      notes.push('texto integral do DOU truncado no início: será baixado de novo (ementa e índice refeitos a partir dele)');
    } else if (missingContent) {
      notes.push('sem texto integral: será baixado de novo da fonte oficial');
    } else if (hasNoOfficialEmenta(act)) {
      semEmenta.push(`${act.fullNumber}: sem ementa oficial; a página omite o bloco "Ementa"`);
    } else if (looksLikeDefectiveEmenta(act.ementa, act.title)) {
      const { ementa, motivo } = newEmentaFor(act);
      if (ementa && ementa !== act.ementa) {
        data.ementa = ementa;
        data.embeddingStatus = 'pending';
        notes.push(`ementa ${motivo}:\n      antes:  ${act.ementa.slice(0, 160)}\n      depois: ${ementa}`);
      } else if (!ementa) {
        pendencias.push(`${act.fullNumber} (${act.id}): ementa defeituosa, ${motivo}`);
      }
    }

    if (act.type === 'mp') {
      data.type = 'medida-provisoria';
      data.hierarchyLevel = getHierarchyLevel('medida-provisoria');
      notes.push('type mp → medida-provisoria');
      if (/^MP\s/.test(act.fullNumber)) {
        const target = act.fullNumber.replace(/^MP\s/, 'Medida Provisória ');
        if (fullNumbers.has(target)) {
          pendencias.push(`${act.fullNumber} (${act.id}): já existe "${target}" (duplicata a resolver à mão)`);
        } else {
          data.fullNumber = target;
          fullNumbers.add(target);
          notes.push(`fullNumber → ${target}`);
        }
      }
    }

    if (Object.keys(data).length > 0 || rescrape) {
      fixes.push({ id: act.id, fullNumber: act.fullNumber, data, notes, rescrape });
    }
  }

  console.log(`\n${acts.length} atos analisados, ${fixes.length} com correção automática.\n`);
  for (const f of fixes) {
    console.log(`• ${f.fullNumber} (${f.id})`);
    f.notes.forEach((n) => console.log(`    ${n}`));
  }
  if (semEmenta.length > 0) {
    console.log(`\nℹ️  ${semEmenta.length} ato(s) sem ementa oficial (nada a corrigir):`);
    semEmenta.forEach((p) => console.log(`    ${p}`));
  }
  if (pendencias.length > 0) {
    console.log(`\n⚠️  ${pendencias.length} pendência(s) sem correção automática:`);
    pendencias.forEach((p) => console.log(`    ${p}`));
  }

  if (!apply) {
    console.log('\n🔒 dry-run: nada foi gravado. Use --apply para aplicar.');
    return;
  }

  for (const f of fixes) {
    if (Object.keys(f.data).length > 0) {
      await prisma.legislativeAct.update({ where: { id: f.id }, data: f.data });
    }
    if (f.rescrape) {
      const r = await scrapeAndIndexAct(f.id);
      if (!r.scraped) {
        console.log(`    ⚠️  ${f.fullNumber}: novo download falhou (${r.error ?? 'sem detalhe'}); texto e ementa ficam como estão.`);
      } else if (!r.indexed) {
        // Sem indexação na hora (ex.: cota do Gemini), o cron retoma.
        await prisma.legislativeAct.update({ where: { id: f.id }, data: { embeddingStatus: 'pending' } });
        console.log(`    ↻ ${f.fullNumber}: texto baixado de novo; indexação fica para o cron.`);
      } else {
        console.log(`    ↻ ${f.fullNumber}: texto baixado de novo e reindexado.`);
      }
    }
  }
  console.log(`\n✅ ${fixes.length} atos processados. Os de ementa nova sem novo download serão reindexados pelo cron process-index-jobs.`);
  if (fixes.length > 0) {
    const removed = await CacheInvalidation.legislativeActs();
    console.log(`🧹 Cache de atos invalidado (${removed} chaves).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
