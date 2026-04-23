/**
 * Wrapper: roda improve-document-descriptions.ts para cada categoria
 * não-TCU e não-informativo em sequência. Útil para um "reprocess tudo"
 * confiável com logs concatenados.
 *
 * Uso:
 *   npx tsx scripts/reprocess-all-categories.ts [--force]
 */

import { execSync } from 'node:child_process';

const FORCE = process.argv.includes('--force');

// Categorias em ordem do menor para o maior (valida pipeline cedo, falha rápido)
const CATEGORIES = [
  'bibliografia',       // 1
  'outro',              // 6
  'boa_pratica',        // 12
  'parecer-vinculante', // 20
  'sumula',             // 37
  'ato-normativo',      // 53
  'orientacao_procedimento', // 56
  'enunciados',         // 129
  'consulta_tcu',       // 137
  'orientacao-normativa', // 162
  'manual-tcu',         // 165
  'decor',              // 171
  'lei-artigo',         // 185
  // 'informativo' (1970) fica de fora — rodar separado (é grande)
  // 'acordao' (1555) tem script próprio (improve-tcu-descriptions.ts)
  // 'parecer' (2) já foi enriquecido
];

function runCategory(category: string): { code: number; elapsed: number } {
  // execSync com shell default (cmd.exe no Windows) e path relativo —
  // evita problemas de quoting em paths com espaço.
  const cmd = `npx tsx scripts/improve-document-descriptions.ts --category ${category}${FORCE ? ' --force' : ''}`;
  const start = Date.now();
  try {
    execSync(cmd, { stdio: 'inherit' });
    return { code: 0, elapsed: Math.round((Date.now() - start) / 1000) };
  } catch (err) {
    const code = (err as { status?: number })?.status ?? 1;
    return { code, elapsed: Math.round((Date.now() - start) / 1000) };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  REPROCESS ALL (não-TCU, não-informativo)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Categorias: ${CATEGORIES.length}`);
  console.log(`Force: ${FORCE}`);
  console.log('');

  const results: Array<{ category: string; code: number; elapsed: number }> = [];

  for (const category of CATEGORIES) {
    console.log(`\n========== ${category} ==========`);
    const { code, elapsed } = runCategory(category);
    results.push({ category, code, elapsed });
    console.log(`[wrapper] ${category} terminou: exit=${code}, elapsed=${elapsed}s`);
  }

  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  RESUMO FINAL                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  for (const r of results) {
    const status = r.code === 0 ? '✓' : '✗';
    console.log(`  ${status} ${r.category.padEnd(24)} — ${r.elapsed}s`);
  }

  const failed = results.filter(r => r.code !== 0);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} categoria(s) com erro. Veja logs acima.`);
    process.exit(1);
  }
  console.log('\n✅ Todas as categorias processadas com sucesso.');
}

main().catch((err) => {
  console.error('❌ Erro fatal no wrapper:', err);
  process.exit(1);
});
