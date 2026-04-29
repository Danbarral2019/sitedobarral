/**
 * Sample/batch de regeneração de Document.summary via IA (Claude Haiku).
 * Lista candidatos sem summary, gera (em dry-run apenas mostra; em --apply grava),
 * e exibe lado a lado description vs novo summary para revisão humana.
 *
 * Resumos gerados ficam com summaryReviewedByAdmin=false (badge "não revisado"
 * aparece para o aluno até admin aprovar via /api/admin/documents/[id]/mark-summary-reviewed).
 *
 * Uso:
 *   # Sample de 5 acórdãos (dry-run — só mostra o que faria):
 *   npx dotenv -e .env.local -- npx tsx scripts/regenerate-summaries-sample.ts --category acordao --limit 5
 *
 *   # Sample de 5 acórdãos (aplica no banco):
 *   npx dotenv -e .env.local -- npx tsx scripts/regenerate-summaries-sample.ts --category acordao --limit 5 --apply
 *
 *   # Batch completo (cuidado, pode demorar e custar):
 *   npx dotenv -e .env.local -- npx tsx scripts/regenerate-summaries-sample.ts --category acordao --apply
 */

import { prisma } from '../lib/prisma';
import { generateDocumentSummary, isSummaryServiceAvailable } from '../lib/summary-generator';

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const onlyMissing = !args.includes('--include-existing');
  let category = 'acordao';
  let limit: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) category = args[++i];
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[++i], 10);
  }
  return { apply, onlyMissing, category, limit };
}

async function main() {
  const { apply, onlyMissing, category, limit } = parseArgs();

  if (!isSummaryServiceAvailable()) {
    console.error('❌ ANTHROPIC_API_KEY não configurada em .env.local');
    process.exit(1);
  }

  console.log('=== Regeneração de summary IA ===');
  console.log(`Categoria: ${category}`);
  console.log(`Modo: ${apply ? 'APPLY (escreve no banco)' : 'DRY-RUN (mostra mas não grava)'}`);
  console.log(`Filtro: ${onlyMissing ? 'apenas docs SEM summary' : 'todos da categoria (sobrescreve)'}`);
  if (limit !== null) console.log(`Limite: ${limit} documentos`);
  console.log('');

  const where: Record<string, unknown> = { category };
  if (onlyMissing) where.summary = null;

  const docs = await prisma.document.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
    },
    orderBy: { uploadedAt: 'desc' },
    ...(limit !== null ? { take: limit } : {}),
  });

  console.log(`Documentos a processar: ${docs.length}\n`);

  if (docs.length === 0) {
    console.log('Nada a fazer.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const progress = `[${i + 1}/${docs.length}]`;
    console.log(`\n${progress} ${doc.title.slice(0, 80)}`);
    console.log(`  description (${(doc.description ?? '').length} chars):`);
    console.log(`    "${(doc.description ?? '').replace(/\s+/g, ' ').slice(0, 240)}…"`);

    try {
      const result = await generateDocumentSummary(
        doc.title,
        doc.description ?? undefined,
        undefined,
        doc.category
      );

      if (!result) {
        console.log(`  ❌ IA retornou null (talvez bloqueio de fonte literal ou erro)`);
        failed++;
        continue;
      }

      const sum = result.summary.replace(/\s+/g, ' ');
      console.log(`  summary IA (${sum.length} chars, confiança ${result.confidence}%):`);
      console.log(`    "${sum.slice(0, 240)}…"`);
      if (result.highlights.length > 0) {
        console.log(`  highlights (${result.highlights.length}):`);
        for (const h of result.highlights.slice(0, 3)) {
          console.log(`    - ${h.slice(0, 140)}`);
        }
      }

      if (apply) {
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            summary: result.summary,
            summaryHighlights: JSON.stringify(result.highlights),
            summaryGeneratedAt: new Date(),
            summaryEditedByAdmin: false,
            summaryReviewedByAdmin: false,
            summaryReviewedAt: null,
            summaryReviewedBy: null,
          },
        });
        console.log(`  ✅ gravado no banco (badge "não revisado" ativo)`);
      } else {
        console.log(`  (dry-run — não gravado)`);
      }

      success++;

      // Rate limit: 1.2s entre chamadas para não estourar quota Anthropic
      if (i < docs.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ erro: ${msg}`);
      failed++;
      // Se for rate limit, esperar mais
      if (msg.includes('429') || msg.includes('rate')) {
        console.log('  ⏳ aguardando 10s por rate limit…');
        await new Promise((r) => setTimeout(r, 10000));
      }
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Total: ${docs.length} | Sucesso: ${success} | Falhas: ${failed}`);
  if (!apply) console.log('(dry-run — re-execute com --apply para gravar)');
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
