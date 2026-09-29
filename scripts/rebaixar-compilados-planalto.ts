/**
 * Baixa de novo os atos do Planalto depois da remoção da redação riscada
 * (`lib/legislative-scrapers/texto-riscado.ts`). Antes dela, o texto
 * compilado trazia a redação superada ao lado da vigente, e o dispositivo
 * aparecia duas vezes (Lei 10.973/2004, art. 2º, III, por exemplo).
 *
 * Dry-run: baixa cada página, compara com o texto gravado e relata tamanho e
 * artigos repetidos antes e depois. Nada é gravado.
 * --apply: grava pelo `scrapeAndIndexAct` (valida o texto, salva e reindexa).
 *
 * O planalto.gov.br precisa estar acessível da máquina que roda o script.
 *
 * Uso:
 *   npx tsx scripts/rebaixar-compilados-planalto.ts             # dry-run
 *   npx tsx scripts/rebaixar-compilados-planalto.ts --apply
 *   npx tsx scripts/rebaixar-compilados-planalto.ts --id=<uuid> [--apply]
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { scrapeAndIndexAct } from '../lib/legislative-scrapers/scrape-and-index';
import { CacheInvalidation } from '../lib/cache/redis-client';

/** Rótulos de artigo que aparecem mais de uma vez no começo de linha. */
function artigosRepetidos(text: string | null): number {
  if (!text) return 0;
  const seen = new Map<string, number>();
  for (const m of text.matchAll(/(?:^|\n)\s*Art\.\s*(\d[\d.]*)\s*[ºo°]?(?:-([A-Z]))?\b/g)) {
    const key = m[1] + (m[2] ?? '');
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.values()].filter((v) => v > 1).length;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];

  const acts = await prisma.legislativeAct.findMany({
    where: {
      ...(onlyId ? { id: onlyId } : {}),
      officialUrl: { contains: 'planalto.gov.br' },
      // `manual` = texto mantido à mão; o cron de atualização também o pula.
      NOT: { scrapeStatus: 'manual' },
    },
    select: { id: true, fullNumber: true, officialUrl: true, content: true },
    orderBy: { fullNumber: 'asc' },
  });

  console.log(`\n${acts.length} atos do Planalto${apply ? '' : ' (dry-run: nada será gravado)'}.\n`);

  let mudariam = 0;
  let falhas = 0;
  let gravados = 0;
  for (const act of acts) {
    if (!apply) {
      const r = await scrapeUrl(act.officialUrl!);
      if (!r.success || !r.content) {
        falhas++;
        console.log(`  ✗ ${act.fullNumber}: ${r.error ?? 'sem conteúdo'}`);
      } else {
        const antes = act.content?.length ?? 0;
        const depois = r.content.length;
        const repAntes = artigosRepetidos(act.content);
        const repDepois = artigosRepetidos(r.content);
        const muda = r.content !== act.content;
        if (muda) mudariam++;
        const pct = antes ? ` (${Math.round((depois / antes) * 100)}%)` : '';
        console.log(
          `  ${muda ? '•' : '='} ${act.fullNumber}: ${antes} → ${depois} caracteres${pct}; ` +
            `artigos repetidos ${repAntes} → ${repDepois}`,
        );
      }
    } else {
      const r = await scrapeAndIndexAct(act.id);
      if (!r.scraped) {
        falhas++;
        console.log(`  ✗ ${act.fullNumber}: ${r.error ?? 'falhou'}; texto anterior mantido.`);
      } else {
        gravados++;
        if (!r.indexed) {
          // Sem indexação na hora (ex.: cota do Gemini), o cron retoma.
          await prisma.legislativeAct.update({ where: { id: act.id }, data: { embeddingStatus: 'pending' } });
        }
        console.log(`  ↻ ${act.fullNumber}: gravado${r.indexed ? ' e reindexado' : '; indexação fica para o cron'}.`);
      }
    }
    await sleep(1500);
  }

  if (!apply) {
    console.log(`\n${mudariam} de ${acts.length} mudariam; ${falhas} falha(s) de download.`);
    console.log('🔒 dry-run: nada foi gravado. Use --apply para gravar.');
    return;
  }

  console.log(`\n✅ ${gravados} gravado(s); ${falhas} falha(s).`);
  if (gravados > 0) {
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
