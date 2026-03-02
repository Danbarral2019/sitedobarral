/**
 * Obsidian Sync — Bidirectional Incremental
 *
 * Unified script: export (DB → Obsidian) + import (Obsidian → DB).
 *
 * Usage:
 *   npx tsx scripts/sync-obsidian.ts                  # incremental sync
 *   npx tsx scripts/sync-obsidian.ts --full           # full export + import
 *   npx tsx scripts/sync-obsidian.ts --export-only    # only Phase 1
 *   npx tsx scripts/sync-obsidian.ts --import-only    # only Phase 2
 *   npx tsx scripts/sync-obsidian.ts --dry-run        # no writes
 *   npx tsx scripts/sync-obsidian.ts --vault <path>   # custom vault path
 *   npx tsx scripts/sync-obsidian.ts --force          # ignore SHA-256 on import
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { resolve } from 'path';

import { runIncrementalExport } from '../lib/obsidian/incremental-export';
import { runLessonImport } from '../lib/obsidian/import';
import { writeSyncState } from '../lib/obsidian/sync-state';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface CliArgs {
  full: boolean;
  exportOnly: boolean;
  importOnly: boolean;
  dryRun: boolean;
  force: boolean;
  vaultPath: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const full = args.includes('--full');
  const exportOnly = args.includes('--export-only');
  const importOnly = args.includes('--import-only');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  let vaultPath = '/Users/danba/Documents/Licitações-Obsidian';
  const vaultIdx = args.indexOf('--vault');
  if (vaultIdx !== -1 && args[vaultIdx + 1]) {
    vaultPath = resolve(args[vaultIdx + 1]);
  }

  if (exportOnly && importOnly) {
    console.error('Erro: --export-only e --import-only sao mutuamente exclusivos.');
    process.exit(1);
  }

  return { full, exportOnly, importOnly, dryRun, force, vaultPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const projectRoot = resolve('.');
  const totalStart = Date.now();

  console.log('=== Obsidian Sync — Lei 14.133/2021 ===\n');

  if (opts.dryRun) console.log('[DRY RUN] Nenhuma escrita em disco ou DB.\n');

  const doExport = !opts.importOnly;
  const doImport = !opts.exportOnly;

  // -----------------------------------------------------------------------
  // Phase 1: Export (DB → Obsidian)
  // -----------------------------------------------------------------------
  if (doExport) {
    console.log('Phase 1: Export (DB → Obsidian)');

    const result = await runIncrementalExport({
      projectRoot,
      outputDir: opts.vaultPath,
      dryRun: opts.dryRun,
      full: opts.full,
    });

    console.log(`  → ${result.filesWritten} arquivos escritos (${(result.durationMs / 1000).toFixed(1)}s)`);
    console.log(`  → Modo: ${result.mode}`);
    console.log('');
  }

  // -----------------------------------------------------------------------
  // Phase 2: Import (Obsidian → DB)
  // -----------------------------------------------------------------------
  if (doImport) {
    console.log('Phase 2: Import (Obsidian → DB)');

    const importStart = Date.now();

    try {
      const stats = await runLessonImport({
        vaultPath: opts.vaultPath,
        dryRun: opts.dryRun,
        force: opts.force,
      });

      const importMs = Date.now() - importStart;

      console.log(`  → ${stats.lessonsUpdated} licoes atualizadas, ${stats.lessonsUnchanged} inalteradas (${(importMs / 1000).toFixed(1)}s)`);

      if (stats.warnings.length > 0) {
        console.log(`  → ${stats.warnings.length} warnings`);
        for (const w of stats.warnings) {
          console.log(`    ! ${w}`);
        }
      }

      // Update import timestamp in sync state
      if (!opts.dryRun) {
        await writeSyncState(projectRoot, {
          lastImportAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Import errors are non-fatal if export succeeded
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  → Erro no import: ${msg}`);
      if (doExport) {
        console.log('  → Export foi bem-sucedido; import falhou.');
      }
    }

    console.log('');
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const totalMs = Date.now() - totalStart;
  console.log(`Sync complete (${(totalMs / 1000).toFixed(1)}s)`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
