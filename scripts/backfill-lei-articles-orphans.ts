/**
 * Backfill de leiArticles em documentos órfãos
 *
 * Reprocessa documentos onde LeiIndexer nunca rodou (leiIndexedAt IS NULL)
 * ou rodou com erro (leiIndexerError IS NOT NULL). Documentos onde rodou
 * com sucesso mas retornou vazio (leiIndexedAt setado, leiArticles null,
 * leiIndexerError null) NÃO são reprocessados — assume-se que são docs
 * legitimamente sem relação com a Lei 14.133.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute --limit 20
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute --categories acordao,informativo
 *
 * Categorias incluídas por default: acordao, informativo, parecer, nota-tecnica,
 *   parecer-vinculante, decor, sumula, consulta_tcu, despacho, boa_pratica,
 *   orientacao_procedimento. Exclui: bibliografia, legislacao, lei-artigo,
 *   ato-normativo, orientacao-normativa, enunciados, manual-tcu (a maioria
 *   destes não trata diretamente de aplicação da Lei 14.133 ou já tem catalogação).
 */

import { prisma } from '../lib/prisma';
import { LeiIndexer } from '../lib/lei-indexer';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const LIMIT = (() => {
  const idx = args.indexOf('--limit');
  if (idx !== -1 && args[idx + 1]) {
    const v = parseInt(args[idx + 1], 10);
    return isNaN(v) ? 0 : v;
  }
  return 0;
})();
const CATEGORIES = (() => {
  const idx = args.indexOf('--categories');
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1].split(',').map(s => s.trim());
  }
  return [
    'acordao', 'informativo', 'parecer', 'nota-tecnica',
    'parecer-vinculante', 'decor', 'sumula', 'consulta_tcu',
    'despacho', 'boa_pratica', 'orientacao_procedimento',
  ];
})();

const DELAY_MS = 100; // tier pago Gemini

async function main() {
  console.log(`\n=== Backfill leiArticles em órfãos ===`);
  console.log(`Modo: ${EXECUTE ? 'EXECUÇÃO (atualiza banco)' : 'DRY-RUN'}`);
  console.log(`Limit: ${LIMIT || 'sem limite'}`);
  console.log(`Categorias: ${CATEGORIES.join(', ')}\n`);

  const orphans = await prisma.document.findMany({
    where: {
      category: { in: CATEGORIES },
      leiArticles: null,
      OR: [
        { leiIndexedAt: null },
        { leiIndexerError: { not: null } },
      ],
    },
    select: {
      id: true, title: true, category: true, tags: true,
      description: true, content: true,
    },
    orderBy: { uploadedAt: 'desc' },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log(`Encontrados ${orphans.length} órfãos para processar.\n`);

  if (orphans.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let recovered = 0;     // ganhou pelo menos 1 artigo
  let emptyLegit = 0;    // Gemini rodou OK mas devolveu []
  let errors = 0;        // exceção real

  for (let i = 0; i < orphans.length; i++) {
    const doc = orphans[i];
    const now = new Date();
    const minConf = ['parecer-vinculante', 'decor', 'parecer'].includes(doc.category || '') ? 60 : 40;

    process.stdout.write(`[${i + 1}/${orphans.length}] ${doc.title.slice(0, 60).padEnd(60)} `);

    try {
      const analysis = await LeiIndexer.analyzeDocument(doc, { minConfidence: minConf });
      const articles = analysis.articles.length > 0
        ? LeiIndexer.resultToLeiArticles(analysis)
        : null;

      if (articles) {
        recovered++;
        console.log(`✓ ${articles.length} arts [${articles.slice(0, 5).map(a => `Art.${a}`).join(', ')}${articles.length > 5 ? '...' : ''}]`);
      } else {
        emptyLegit++;
        console.log(`○ vazio (sem relação)`);
      }

      if (EXECUTE) {
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            ...(articles ? { leiArticles: JSON.stringify(articles) } : {}),
            leiIndexedAt: now,
            leiIndexerError: null,
          },
        });
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ERRO: ${msg.slice(0, 80)}`);
      if (EXECUTE) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { leiIndexedAt: now, leiIndexerError: msg.slice(0, 500) },
        }).catch(() => {});
      }
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Recuperados (>=1 artigo):  ${recovered} (${((recovered / orphans.length) * 100).toFixed(1)}%)`);
  console.log(`Vazios legítimos:          ${emptyLegit}`);
  console.log(`Erros:                     ${errors}`);
  if (!EXECUTE) {
    console.log(`\n⚠ Modo DRY-RUN — nada foi persistido. Rode com --execute para aplicar.`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
