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
 *   # Preview barato — query + breakdown + estimativa de custo, sem chamar Gemini:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --count-only --all-categories
 *
 *   # Default — só categorias densas:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute
 *
 *   # Expandido — TODAS as categorias com leiIndexedAt IS NULL:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute --all-categories
 *
 *   # Categorias específicas:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute --categories acordao,informativo
 *
 *   # Limit para testar:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-lei-articles-orphans.ts --execute --limit 20
 *
 * Categorias incluídas por default: acordao, informativo, parecer, nota-tecnica,
 *   parecer-vinculante, decor, sumula, consulta_tcu, despacho, boa_pratica,
 *   orientacao_procedimento. Exclui por default: bibliografia, legislacao,
 *   lei-artigo, ato-normativo, orientacao-normativa, enunciados, manual-tcu
 *   (maioria não trata diretamente de aplicação da Lei 14.133 ou já tem
 *   catalogação). Para incluir TUDO, use `--all-categories`.
 *
 * Custo medido em 2026-05-16 (auditoria 2026-05-16 P1.4): ~$1 USD para
 * 1.002 órfãos com `--all-categories` (10% a mais que o default, ~108 docs
 * em categorias "excluídas" como orientacao-normativa, enunciados, etc.).
 * A projeção original da auditoria (~4.987 docs / ~$5 USD) refletia o
 * backlog antes das execuções da PR #8 e dos crons regulares.
 */

import { prisma } from '../lib/prisma';
import { LeiIndexer } from '../lib/lei-indexer';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const ALL_CATEGORIES = args.includes('--all-categories');
const COUNT_ONLY = args.includes('--count-only');
const LIMIT = (() => {
  const idx = args.indexOf('--limit');
  if (idx !== -1 && args[idx + 1]) {
    const v = parseInt(args[idx + 1], 10);
    return isNaN(v) ? 0 : v;
  }
  return 0;
})();
const DEFAULT_CATEGORIES = [
  'acordao', 'informativo', 'parecer', 'nota-tecnica',
  'parecer-vinculante', 'decor', 'sumula', 'consulta_tcu',
  'despacho', 'boa_pratica', 'orientacao_procedimento',
];
const EXPLICIT_CATEGORIES = (() => {
  const idx = args.indexOf('--categories');
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1].split(',').map(s => s.trim());
  }
  return null;
})();

// --all-categories e --categories são mutuamente exclusivos.
if (ALL_CATEGORIES && EXPLICIT_CATEGORIES) {
  console.error('Erro: --all-categories e --categories são mutuamente exclusivos.');
  process.exit(1);
}

const DELAY_MS = 100; // tier pago Gemini

async function main() {
  console.log(`\n=== Backfill leiArticles em órfãos ===`);
  console.log(`Modo: ${EXECUTE ? 'EXECUÇÃO (atualiza banco)' : 'DRY-RUN'}`);
  console.log(`Limit: ${LIMIT || 'sem limite'}`);
  if (ALL_CATEGORIES) {
    console.log(`Categorias: TODAS (--all-categories — sem filtro)`);
  } else {
    const cats = EXPLICIT_CATEGORIES ?? DEFAULT_CATEGORIES;
    console.log(`Categorias: ${cats.join(', ')}`);
  }
  console.log('');

  // Quando --all-categories, omitimos completamente o filtro `category` do
  // where (sem `{ in: [...] }`) — assim apanha tudo, inclusive docs com
  // category null. Auditoria 2026-05-16 P1.4 contava ~4.987 docs com
  // leiIndexedAt IS NULL no universo completo.
  const categoryFilter = ALL_CATEGORIES
    ? {}
    : { category: { in: EXPLICIT_CATEGORIES ?? DEFAULT_CATEGORIES } };

  const orphans = await prisma.document.findMany({
    where: {
      ...categoryFilter,
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

  // --count-only: breakdown por categoria e estimativa de custo, sem chamar
  // Gemini. Útil antes de gastar API em populações grandes.
  if (COUNT_ONLY) {
    const byCategory = new Map<string, number>();
    for (const doc of orphans) {
      const cat = doc.category || '(null)';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    }
    console.log('Breakdown por categoria:');
    const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, n] of sorted) {
      console.log(`  ${cat.padEnd(30)} ${String(n).padStart(6)}`);
    }
    // Custo estimado: ~$0.001/doc (Gemini Flash, ~3k input + 200 output)
    const estUsd = (orphans.length * 0.001).toFixed(2);
    console.log(`\nCusto Gemini estimado: ~$${estUsd} USD`);
    console.log('⚠ --count-only: nada foi chamado, nada foi persistido.');
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
