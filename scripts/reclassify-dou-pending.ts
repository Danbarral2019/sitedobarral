/**
 * Reclassifica documentos DOU em aprovação pendente usando o classifier endurecido.
 *
 * Após as mudanças em `lib/dou-classifier.ts` (incorporação de `isAtoNormativoGeral`
 * e expansão de `IRRELEVANT_KEYWORDS`), atos concretos que entraram em pending no
 * regime antigo passam a ser detectados como `auto_rejected` ou recategorizados.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-dou-pending.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-dou-pending.ts
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { DOUClassifier } from '../lib/dou-classifier';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Reclassificação de DOUStagingDocument pending`);
  console.log(`  ${DRY_RUN ? '🔍 MODO DRY-RUN' : '✅ MODO EXECUÇÃO'}`);
  console.log(`${'='.repeat(60)}\n`);

  const pending = await prisma.dOUStagingDocument.findMany({
    where: { approvalStatus: 'pending' },
    select: {
      id: true,
      title: true,
      abstract: true,
      fullContent: true,
      category: true,
      confidence: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total pending atual: ${pending.length}\n`);

  const stats = {
    total: pending.length,
    rejeitados: 0,
    aprovados: 0,
    recategorizados: 0,
    inalterados: 0,
    erros: 0,
  };

  for (const doc of pending) {
    try {
      const enriched = doc.fullContent
        ? {
            conteudo: doc.fullContent,
            edicao: null,
            secao: null,
            pagina: null,
            data: null,
            orgao: '',
            caracteres: doc.fullContent.length,
            paragrafos: 0,
          }
        : undefined;
      const result = DOUClassifier.classify(doc.title, doc.abstract, enriched);

      const willReject = result.status === 'auto_rejected';
      const willApprove = result.status === 'auto_approved';
      const categoryChanged = result.category !== doc.category;

      const tag = willReject ? '❌' : willApprove ? '✅' : categoryChanged ? '🔄' : '⏸️ ';
      console.log(`${tag} ${doc.title.slice(0, 80)}`);
      console.log(`   ${doc.category} (${doc.confidence}%) → ${result.category} (${result.confidence}%) status=${result.status}`);
      console.log(`   ${result.reasoning.slice(0, 2).join(' | ')}`);

      if (willReject) stats.rejeitados++;
      else if (willApprove) stats.aprovados++;
      else if (categoryChanged) stats.recategorizados++;
      else { stats.inalterados++; continue; }

      if (!DRY_RUN) {
        await prisma.dOUStagingDocument.update({
          where: { id: doc.id },
          data: {
            category: result.category,
            approvalStatus: result.status,
            confidence: result.confidence,
            reasoning: JSON.stringify(result.reasoning),
            isRelevant: result.isRelevant,
            requiresReview: result.requiresReview,
          },
        });
      }
    } catch (err) {
      stats.erros++;
      console.error(`Erro em ${doc.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTADO ${DRY_RUN ? '(simulado)' : ''}:`);
  console.log(`  Total processados: ${stats.total}`);
  console.log(`  ❌ Auto-rejeitados:  ${stats.rejeitados}`);
  console.log(`  ✅ Auto-aprovados:   ${stats.aprovados}`);
  console.log(`  🔄 Recategorizados:  ${stats.recategorizados}`);
  console.log(`  ⏸️  Inalterados:      ${stats.inalterados}`);
  console.log(`  ⚠️  Erros:            ${stats.erros}`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
