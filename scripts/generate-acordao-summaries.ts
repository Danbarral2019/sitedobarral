/**
 * Geração de Resumos Automáticos para Acórdãos TCU
 *
 * Gera resumos executivos usando Claude AI para acórdãos que ainda não possuem summary.
 * Utiliza a função generateDocumentSummary() do lib/summary-generator.ts.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-acordao-summaries.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-acordao-summaries.ts --limit 10
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-acordao-summaries.ts --force
 *   npx dotenv -e .env.local -- npx tsx scripts/generate-acordao-summaries.ts --force --limit 5
 */

import { PrismaClient } from '@prisma/client';
import { generateDocumentSummary } from '../lib/summary-generator';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

interface Options {
  dryRun: boolean;
  limit: number | null;
  force: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    dryRun: args.includes('--dry-run'),
    limit: null,
    force: args.includes('--force'),
  };

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const n = parseInt(args[limitIdx + 1], 10);
    if (!isNaN(n) && n > 0) {
      options.limit = n;
    }
  }

  return options;
}

async function generateSummaries(options: Options) {
  const { dryRun, limit, force } = options;

  console.log('=== Gerador de Resumos de Acordaos TCU ===\n');
  console.log('Options:', { dryRun, limit, force });
  console.log('');

  try {
    // 1. Buscar acordaos candidatos
    const whereClause: Record<string, unknown> = {
      category: 'acordao',
    };

    if (!force) {
      whereClause.summary = null;
    }

    const acordaos = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        tcuEmentaCompleta: true,
        tcuTextoCompleto: true,
        summary: true,
        summaryGeneratedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });

    const totalAcordaos = await prisma.document.count({
      where: { category: 'acordao' },
    });

    const withSummary = await prisma.document.count({
      where: { category: 'acordao', summary: { not: null } },
    });

    console.log(`Total de acordaos no banco: ${totalAcordaos}`);
    console.log(`Ja possuem resumo: ${withSummary}`);
    console.log(`Sem resumo: ${totalAcordaos - withSummary}`);
    console.log(`Selecionados para processar: ${acordaos.length}${force ? ' (--force: inclui com resumo)' : ''}`);
    console.log('');

    if (acordaos.length === 0) {
      console.log('Nenhum acordao para processar.');
      return;
    }

    // 2. Dry-run: apenas listar
    if (dryRun) {
      console.log('--- Modo dry-run: listando acordaos que seriam processados ---\n');
      acordaos.forEach((doc, idx) => {
        const status = doc.summary ? 'COM resumo (seria regenerado)' : 'SEM resumo';
        console.log(`  ${idx + 1}. ${doc.title}`);
        console.log(`     ID: ${doc.id}`);
        console.log(`     Status: ${status}`);
        console.log(`     Ementa TCU: ${doc.tcuEmentaCompleta ? `${doc.tcuEmentaCompleta.length} chars` : 'N/A'}`);
        console.log(`     Texto completo: ${doc.tcuTextoCompleto ? `${doc.tcuTextoCompleto.length} chars` : 'N/A'}`);
        console.log('');
      });
      console.log(`Total: ${acordaos.length} acordao(s) seria(m) processado(s).`);
      return;
    }

    // 3. Verificar se ANTHROPIC_API_KEY esta configurada
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ERRO: ANTHROPIC_API_KEY nao configurada. Configure a variavel de ambiente.');
      process.exit(1);
    }

    // 4. Processar cada acordao
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < acordaos.length; i++) {
      const doc = acordaos[i];
      console.log(`[${i + 1}/${acordaos.length}] Processando: ${doc.title}`);

      try {
        // Montar texto completo para analise
        const fullTextParts: string[] = [];
        if (doc.description) fullTextParts.push(doc.description);
        if (doc.tcuEmentaCompleta) fullTextParts.push(doc.tcuEmentaCompleta);
        if (doc.tcuTextoCompleto) fullTextParts.push(doc.tcuTextoCompleto);
        const fullText = fullTextParts.join('\n\n') || undefined;

        // Gerar resumo
        const result = await generateDocumentSummary(
          doc.title,
          doc.description || undefined,
          fullText,
          'acordao'
        );

        if (result) {
          // Atualizar no banco
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              summary: result.summary,
              summaryHighlights: JSON.stringify(result.highlights),
              summaryGeneratedAt: new Date(),
            },
          });

          successCount++;
          console.log(`  -> Resumo gerado (${result.summary.length} chars, ${result.highlights.length} destaques, confianca: ${result.confidence}%)`);
        } else {
          errorCount++;
          console.log(`  -> FALHA: generateDocumentSummary retornou null`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  -> ERRO:`, error instanceof Error ? error.message : error);
      }

      // Rate limiting: espera 1 segundo entre requisicoes
      if (i < acordaos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 5. Resumo final
    console.log('\n=== Resultado ===');
    console.log(`Processados: ${acordaos.length}`);
    console.log(`Sucesso: ${successCount}`);
    console.log(`Falhas: ${errorCount}`);

  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const options = parseArgs();
generateSummaries(options);
