/**
 * Popula `Document.leiArticlesCited` — os artigos da Lei 14.133 que o documento
 * CITA textualmente, entre os que estão vinculados a ele em `leiArticlesArr`.
 *
 * Determinístico, sem LLM, custo zero. Usa lib/lei-14133/citation-extractor.ts.
 *
 * Por quê: a vinculação é feita por LLM, cujo prompt pede artigos "relacionados
 * ao tema (mesmo que não mencionados)", com corte de confiança 40 em produção.
 * O art. 5º acumulou 1.140 documentos, dos quais só 39% o citam. O indexador
 * calcula `mentions` e o descarta na escrita — este script recupera esse sinal
 * lendo o texto, e permite à Lei Comentada separar "cita este artigo" de
 * "relacionado por tema" sem apagar vínculo nenhum.
 *
 * Idempotente: recalcula do zero a cada execução. Só grava quando muda.
 * NÃO altera `leiArticlesArr` — nada é desvinculado aqui.
 *
 * Uso: npx tsx scripts/backfill-article-citations.ts              # dry-run
 *      npx tsx scripts/backfill-article-citations.ts --execute
 *      npx tsx scripts/backfill-article-citations.ts --execute --limit=100
 *
 * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
 */
import { prisma } from '../lib/prisma';
import { citesArticle } from '../lib/lei-14133/citation-extractor';

const EXECUTE = process.argv.includes('--execute');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
const BATCH = 200;

const eq = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN (use --execute)\n');

  const total = await prisma.document.count({ where: { leiArticlesArr: { isEmpty: false } } });
  console.log(`Documentos vinculados a algum artigo: ${total}${LIMIT ? ` (limitado a ${LIMIT})` : ''}\n`);

  let processados = 0, alterados = 0, semTexto = 0;
  let vinculos = 0, citados = 0;
  const porArtigo = new Map<string, { total: number; cita: number }>();

  for (let skip = 0; skip < (LIMIT ?? total); skip += BATCH) {
    const docs = await prisma.document.findMany({
      where: { leiArticlesArr: { isEmpty: false } },
      select: { id: true, content: true, description: true, leiArticlesArr: true, leiArticlesCited: true },
      orderBy: { id: 'asc' },
      skip,
      take: Math.min(BATCH, (LIMIT ?? total) - skip),
    });
    if (!docs.length) break;

    for (const doc of docs) {
      // O texto da fonte é `content`; `description` é extrato/curadoria, mas em
      // 40% das ONs é tudo o que há — então entra como complemento, não substituto.
      const texto = [doc.content, doc.description].filter(Boolean).join('\n');
      if (!texto.trim()) semTexto++;

      const cited = doc.leiArticlesArr.filter((art) => citesArticle(texto, art).cites);

      vinculos += doc.leiArticlesArr.length;
      citados += cited.length;
      for (const art of doc.leiArticlesArr) {
        const e = porArtigo.get(art) ?? { total: 0, cita: 0 };
        e.total++;
        if (cited.includes(art)) e.cita++;
        porArtigo.set(art, e);
      }

      if (!eq(cited, doc.leiArticlesCited)) {
        alterados++;
        if (EXECUTE) {
          await prisma.document.update({ where: { id: doc.id }, data: { leiArticlesCited: cited } });
        }
      }
      processados++;
    }
    process.stdout.write(`\r  ${processados}/${LIMIT ?? total} processados, ${alterados} a atualizar…`);
  }

  console.log(`\n\n${'─'.repeat(60)}`);
  console.log(`Processados:        ${processados}`);
  console.log(`Sem texto algum:    ${semTexto}`);
  console.log(`Registros alterados:${alterados}`);
  console.log(`\nVínculos totais:    ${vinculos}`);
  console.log(`Com citação:        ${citados} (${Math.round((citados / vinculos) * 100)}%)`);
  console.log(`Só por tema:        ${vinculos - citados} (${Math.round(((vinculos - citados) / vinculos) * 100)}%)`);

  const top = [...porArtigo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12)
    .map(([art, v]) => ({
      artigo: art,
      vinculados: v.total,
      citam: v.cita,
      '% cita': `${Math.round((v.cita / v.total) * 100)}%`,
      'só tema': v.total - v.cita,
    }));
  console.log('\nTop 12 artigos:');
  console.table(top);

  if (!EXECUTE) console.log('🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
