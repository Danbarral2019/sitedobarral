/**
 * Export Obsidian Vault — Lei 14.133/2021
 *
 * Gera um vault Obsidian com [[wikilinks]] bidirecionais a partir dos dados
 * do site do Barral (artigos, documentos, atos normativos, jurisprudência,
 * enunciados e temas).
 *
 * Uso:
 *   npx tsx scripts/export-obsidian-vault.ts
 *   npx tsx scripts/export-obsidian-vault.ts --output-dir ~/Obsidian/Licitações
 *   npx tsx scripts/export-obsidian-vault.ts --dry-run
 *   npx tsx scripts/export-obsidian-vault.ts --no-db
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { resolve } from 'path';
import { homedir } from 'os';

import {
  type DbDocument,
  type DbLegislativeAct,
  type DbTribunalDecision,
  type FileEntry,
  EXPORT_DOC_SELECT,
  EXPORT_ACT_SELECT,
  EXPORT_DECISION_SELECT,
  EXPORT_DECISION_WHERE,
  buildLinkGraph,
  generateAllFiles,
  writeVault,
  LEI_14133_ARTIGOS,
  ENUNCIADOS,
  CROSS_REFERENCES,
  TEMAS_LICITACOES,
} from '../lib/obsidian/export';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noDb = args.includes('--no-db');

  let outputDir = resolve(homedir(), 'Obsidian', 'Licitações');
  const dirIdx = args.indexOf('--output-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    outputDir = resolve(args[dirIdx + 1].replace(/^~/, homedir()));
  }

  console.log('=== Export Obsidian Vault — Lei 14.133/2021 ===\n');
  console.log(`Output: ${outputDir}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`No DB: ${noDb}`);
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 1: Collect data
  // -----------------------------------------------------------------------
  console.log('--- Fase 1: Coleta de dados ---');

  const articleEntries = Object.entries(LEI_14133_ARTIGOS);
  console.log(`  Artigos: ${articleEntries.length}`);
  console.log(`  Enunciados: ${ENUNCIADOS.length}`);
  console.log(`  Cross-references: ${CROSS_REFERENCES.length} grupos`);
  console.log(`  Temas: ${TEMAS_LICITACOES.length}`);

  let documents: DbDocument[] = [];
  let acts: DbLegislativeAct[] = [];
  let decisions: DbTribunalDecision[] = [];

  if (!noDb) {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaNeon } = await import('@prisma/adapter-neon');
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

    try {
      documents = await prisma.document.findMany({ select: EXPORT_DOC_SELECT });
      console.log(`  Documentos (DB): ${documents.length}`);

      acts = await prisma.legislativeAct.findMany({ select: EXPORT_ACT_SELECT });
      console.log(`  Atos Normativos (DB): ${acts.length}`);

      decisions = await prisma.tribunalDecision.findMany({
        where: EXPORT_DECISION_WHERE,
        select: EXPORT_DECISION_SELECT,
      });
      console.log(`  Jurisprudência (DB): ${decisions.length}`);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('  (DB ignorado — modo --no-db)');
  }

  console.log('');

  // -----------------------------------------------------------------------
  // Phase 2: Build link graph
  // -----------------------------------------------------------------------
  console.log('--- Fase 2: Construindo grafo de links ---');
  const graph = buildLinkGraph(documents, acts, decisions);
  console.log(`  articleToDocuments: ${graph.articleToDocuments.size} artigos com docs`);
  console.log(`  articleToActs: ${graph.articleToActs.size} artigos com atos`);
  console.log(`  articleToDecisions: ${graph.articleToDecisions.size} artigos com decisões`);
  console.log(`  articleToEnunciados: ${graph.articleToEnunciados.size} artigos com enunciados`);
  console.log(`  articleToThemes: ${graph.articleToThemes.size} artigos com temas`);
  console.log(`  articleToCrossRefs: ${graph.articleToCrossRefs.size} artigos com cross-refs`);
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 3: Generate files
  // -----------------------------------------------------------------------
  console.log('--- Fase 3: Gerando arquivos Markdown ---');
  const files: FileEntry[] = generateAllFiles(documents, acts, decisions);
  console.log(`Total: ${files.length} arquivos`);
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 4: Write (or dry-run)
  // -----------------------------------------------------------------------
  if (dryRun) {
    console.log('=== DRY RUN — nenhum arquivo criado ===');
    console.log('');
    console.log('Resumo por pasta:');
    const byDir = new Map<string, number>();
    for (const f of files) {
      const dir = f.path.split('/')[0] || '(raiz)';
      byDir.set(dir, (byDir.get(dir) || 0) + 1);
    }
    for (const [dir, count] of [...byDir].sort()) {
      console.log(`  ${dir}: ${count} arquivos`);
    }
  } else {
    console.log(`Escrevendo ${files.length} arquivos em ${outputDir}...`);
    await writeVault(outputDir, files);
    console.log('Vault exportado com sucesso!');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
