/**
 * Import Obsidian Lessons — Vault para Banco de Dados
 *
 * Importa conteudo de cursos do vault Obsidian para o banco de dados (LMS).
 * Converte wikilinks/callouts, faz upsert de modulos/licoes/videos e detecta orfaos.
 *
 * Uso:
 *   npx tsx scripts/import-obsidian-lessons.ts              # all courses
 *   npx tsx scripts/import-obsidian-lessons.ts --course planejamento-contratacoes
 *   npx tsx scripts/import-obsidian-lessons.ts --dry-run
 *   npx tsx scripts/import-obsidian-lessons.ts --force       # ignore content hash, update all
 *   npx tsx scripts/import-obsidian-lessons.ts --vault /custom/path
 */

import { prisma } from '../lib/prisma';
import { runLessonImport } from '../lib/obsidian/import';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  let courseSlug: string | undefined;
  const courseIdx = args.indexOf('--course');
  if (courseIdx !== -1 && args[courseIdx + 1]) {
    courseSlug = args[courseIdx + 1];
  }

  let vaultPath = '/Users/danba/Documents/Licitações-Obsidian';
  const vaultIdx = args.indexOf('--vault');
  if (vaultIdx !== -1 && args[vaultIdx + 1]) {
    vaultPath = args[vaultIdx + 1];
  }

  return { dryRun, force, courseSlug, vaultPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { dryRun, force, courseSlug, vaultPath } = parseArgs();

  console.log('=== Obsidian -> Site — Import Lessons ===\n');
  console.log(`Vault: ${vaultPath}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Force: ${force}`);
  if (courseSlug) console.log(`Course: ${courseSlug}`);
  console.log('');

  const stats = await runLessonImport({ vaultPath, dryRun, force, courseSlug });

  // Summary
  console.log('--- Resultado ---');
  console.log(`Cursos processados: ${stats.coursesProcessed}`);
  console.log(
    `Modulos criados: ${stats.modulesCreated} | atualizados: ${stats.modulesUpdated}`,
  );
  console.log(
    `Licoes criadas: ${stats.lessonsCreated} | atualizadas: ${stats.lessonsUpdated} | inalteradas: ${stats.lessonsUnchanged}`,
  );
  console.log(`Videos criados: ${stats.videosCreated}`);
  console.log(`Warnings: ${stats.warnings.length}`);

  if (stats.warnings.length > 0) {
    console.log('\n--- Warnings ---');
    for (const w of stats.warnings) {
      console.log(`  ! ${w}`);
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhuma alteracao feita no banco de dados.');
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
