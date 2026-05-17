/**
 * Reporta progresso da migração da Onda 4 (Padronização API).
 *
 * Uso:
 *   npx tsx scripts/api-migration-status.ts
 *   npm run migration:api:status
 *
 * Saída: tabela com contagens das principais métricas.
 */

import { execSync } from 'child_process';

// Patterns contain single quotes — pass them through execSync via env vars
// to avoid double-escaping headaches with shell quoting.
function runGrep(grepFlags: string, pattern: string, paths: string): number {
  try {
    const out = execSync(
      `grep ${grepFlags} --include='*.ts' -E -e "$PATTERN" ${paths} 2>/dev/null | wc -l`,
      {
        encoding: 'utf8',
        env: { ...process.env, PATTERN: pattern },
        shell: '/bin/bash',
      }
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function count(pattern: string, paths: string): number {
  return runGrep('-rl', pattern, paths);
}

function countOccurrences(pattern: string, paths: string): number {
  return runGrep('-rh', pattern, paths);
}

function main(): void {
  // Use string fragments without quotes — grep -E handles the regex; the
  // shell substitutes $PATTERN from the env without quoting issues.
  const usingLegacy = count("from '@/lib/api-middleware'", 'app lib');
  const usingNew = count("from '@/lib/api/handler'", 'app lib');
  const errorJson = countOccurrences(
    'NextResponse\\.json\\(\\s*\\{\\s*error\\s*:',
    'app/api'
  );

  const totalToMigrate = usingLegacy + Math.max(0, errorJson - usingLegacy);

  console.log('\n=== Onda 4 — Migração API Pattern ===\n');
  console.log(`Arquivos usando lib/api-middleware:   ${usingLegacy.toString().padStart(4)}  (alvo: 0)`);
  console.log(`Arquivos usando lib/api/handler:      ${usingNew.toString().padStart(4)}  (alvo: ≥190)`);
  console.log(`Ocorrências de NextResponse.json({error}: ${errorJson.toString().padStart(4)}  (alvo: 0 em rotas migradas)`);
  console.log(`Rotas estimadas a migrar (restantes): ${totalToMigrate.toString().padStart(4)}`);

  const pct = usingNew > 0 ? Math.round((usingNew / (usingNew + usingLegacy)) * 100) : 0;
  console.log(`\nProgresso da migração: ${pct}%`);
}

main();
