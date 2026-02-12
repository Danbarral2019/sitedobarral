#!/usr/bin/env npx tsx
/**
 * Reconciliação: LegislativeAct → Document
 *
 * Cria um Document para cada LegislativeAct que ainda não tem,
 * integrando os 53 atos normativos existentes ao sistema unificado.
 *
 * Isso permite que o scan histórico e o cron diário detectem
 * atos já existentes e evitem duplicatas.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/reconcile-legislative-acts-dou.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/reconcile-legislative-acts-dou.ts --execute
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const execute = args.includes('--execute');

if (!dryRun && !execute) {
  console.log('Uso: npx tsx scripts/reconcile-legislative-acts-dou.ts --dry-run|--execute');
  process.exit(1);
}

/**
 * Verifica se já existe um Document correspondente ao LegislativeAct.
 * Busca por título exato OU por fullNumber no título.
 */
async function findExistingDocument(act: { title: string; fullNumber: string; number: string }) {
  // Busca exata por título primeiro
  const exactMatch = await prisma.document.findFirst({
    where: { title: act.title },
    select: { id: true, title: true, douUrl: true },
  });
  if (exactMatch) return exactMatch;

  // Busca por fullNumber no título (ex: "IN SEGES/ME 65/2021")
  // Exclui pareceres/DECOR que apenas referenciam o ato
  const fullNumberMatch = await prisma.document.findFirst({
    where: {
      title: { contains: act.fullNumber, mode: 'insensitive' as const },
      NOT: {
        OR: [
          { title: { startsWith: 'DECOR', mode: 'insensitive' as const } },
          { title: { startsWith: 'PARECER', mode: 'insensitive' as const } },
          { category: 'parecer' },
          { category: 'decor' },
        ],
      },
    },
    select: { id: true, title: true, douUrl: true },
  });
  if (fullNumberMatch) return fullNumberMatch;

  return null;
}

async function main() {
  console.log('=== Reconciliação LegislativeAct → Document ===');
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}\n`);

  // 1. Buscar todos os LegislativeActs
  const acts = await prisma.legislativeAct.findMany({
    orderBy: { publishDate: 'asc' },
  });

  console.log(`Total de LegislativeActs: ${acts.length}\n`);

  let alreadyHasDocCount = 0;
  let documentCreatedCount = 0;
  let documentUpdatedCount = 0;
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    console.log(`[${i + 1}/${acts.length}] ${act.fullNumber}`);

    const existingDoc = await findExistingDocument(act);

    if (existingDoc) {
      console.log(`  Já tem Document: "${existingDoc.title.substring(0, 60)}..."`);

      // Verificar se precisa atualizar campos (leiArticles, category, etc.)
      if (execute) {
        const updateData: Record<string, unknown> = {};

        // Garantir category = legislacao
        updateData.category = 'legislacao';

        // Garantir tags incluem ato_normativo
        updateData.tags = JSON.stringify(['ato_normativo', act.type]);

        // Atualizar leiArticles se o LegislativeAct tem e o Document não
        if (act.leiArticles) {
          updateData.leiArticles = act.leiArticles;
        }

        await prisma.document.update({
          where: { id: existingDoc.id },
          data: updateData,
        });
        documentUpdatedCount++;
        updated.push(act.fullNumber);
        console.log(`  Atualizado (category, tags, leiArticles)`);
      } else {
        updated.push(act.fullNumber);
        console.log(`  [DRY-RUN] Seria atualizado`);
      }

      alreadyHasDocCount++;
      continue;
    }

    // Criar novo Document
    console.log(`  Sem Document correspondente`);

    if (execute) {
      await prisma.document.create({
        data: {
          title: act.title,
          description: act.ementa.substring(0, 500),
          type: 'link',
          url: act.officialUrl || `https://www.planalto.gov.br/ccivil_03/_ato${getAtoRange(act.year)}/${act.year}/${getAtoPrefix(act.type)}/${getAtoPrefix(act.type)}${act.number.replace(/\./g, '')}.htm`,
          category: 'legislacao',
          isPublic: true,
          tags: JSON.stringify(['ato_normativo', act.type]),
          leiArticles: act.leiArticles || JSON.stringify([]),
          content: act.ementa,
          reviewed: true,
          reviewedAt: new Date(),
          reviewedBy: 'reconcile-script',
          embeddingStatus: 'pending',
        },
      });
      documentCreatedCount++;
      created.push(act.fullNumber);
      console.log(`  Document CRIADO`);
    } else {
      created.push(act.fullNumber);
      console.log(`  [DRY-RUN] Seria criado`);
    }
  }

  // --- Relatório ---
  console.log('\n========================================');
  console.log('       RELATORIO DE RECONCILIACAO');
  console.log('========================================');
  console.log(`Total processados: ${acts.length}`);
  console.log(`Já tinham Document: ${alreadyHasDocCount} (atualizados)`);
  console.log(`Documents novos: ${created.length}`);
  if (execute) {
    console.log(`Documents criados: ${documentCreatedCount}`);
    console.log(`Documents atualizados: ${documentUpdatedCount}`);
  }

  if (created.length > 0) {
    console.log('\n--- Documents a criar ---');
    created.forEach(n => console.log(`  + ${n}`));
  }

  if (updated.length > 0) {
    console.log('\n--- Documents a atualizar ---');
    updated.forEach(n => console.log(`  ~ ${n}`));
  }

  if (dryRun) {
    console.log('\n[DRY-RUN] Nenhuma alteracao feita. Use --execute para aplicar.');
  }

  console.log('\n========================================');
  await prisma.$disconnect();
}

/** Retorna o range de anos para URL do Planalto: 2019-2022, 2023-2026, etc. */
function getAtoRange(year: number): string {
  if (year >= 2023) return '2023-2026';
  if (year >= 2019) return '2019-2022';
  if (year >= 2015) return '2015-2018';
  if (year >= 2011) return '2011-2014';
  return '2007-2010';
}

/** Retorna o prefixo da URL do Planalto baseado no tipo */
function getAtoPrefix(type: string): string {
  switch (type) {
    case 'decreto': return 'D';
    case 'lei': return 'L';
    case 'mp': return 'Mpv';
    default: return '';
  }
}

main().catch(async (error) => {
  console.error('Erro fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
