/**
 * apply-ons-update.ts
 *
 * Aplica no DB as melhorias propostas pelo fix-and-diff-ons.ts.
 *
 * Sem --apply: dry-run (mostra o que faria)
 * Com --apply: escreve no DB
 *
 * Esta primeira leva só atualiza `description` (paráfrase IA → texto oficial
 * limpo da listagem AGU). As URLs DOU específicas exigem outro passe (87 das
 * 98 estão com arrasto do parser; ver README do diff report).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/apply-ons-update.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/apply-ons-update.ts --apply
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface DiffRow {
  numero: number;
  ano: number;
  status: string;
  dbId?: string;
  descricaoAntiga?: string | null;
  descricaoNova?: string;
  descMudou?: boolean;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const today = new Date().toISOString().slice(0, 10);
  const diffPath = path.join(process.cwd(), 'docs', 'audits', `${today}-ons-diff.json`);

  if (!fs.existsSync(diffPath)) {
    console.error(`Diff JSON não encontrado: ${diffPath}`);
    console.error('Rode primeiro: npx tsx scripts/fix-and-diff-ons.ts');
    process.exit(1);
  }

  const { diffs } = JSON.parse(fs.readFileSync(diffPath, 'utf-8')) as { diffs: DiffRow[] };

  // Filtra só as que têm descrição mudando E têm dbId
  const candidatos = diffs.filter(
    (d) => d.status === 'match-melhora' && d.descMudou && d.dbId && d.descricaoNova
  );

  console.log('='.repeat(60));
  console.log(`APPLY-ONS-UPDATE — ${apply ? 'APPLY (escreve no DB)' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(`Candidatos: ${candidatos.length} ONs com descrição a atualizar`);
  console.log('');

  if (!apply) {
    console.log('Top 5 alvos:');
    for (const d of candidatos.slice(0, 5)) {
      console.log(
        `  ON ${d.numero}/${d.ano}: ${d.descricaoNova!.slice(0, 80)}...`
      );
    }
    console.log('');
    console.log('Para aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/apply-ons-update.ts --apply');
    return;
  }

  // APLICA
  console.log('Iniciando atualização no DB...\n');
  let success = 0;
  let errors = 0;
  const failures: Array<{ id: string; numero: number; ano: number; error: string }> = [];

  for (const d of candidatos) {
    try {
      await prisma.document.update({
        where: { id: d.dbId },
        data: {
          description: d.descricaoNova,
          // Marcar reviewed=false — precisa validação humana pós-substituição
          reviewed: false,
          reviewedAt: null,
        },
      });
      success++;
      if (success % 10 === 0) console.log(`  ${success}/${candidatos.length}...`);
    } catch (e) {
      errors++;
      failures.push({
        id: d.dbId!,
        numero: d.numero,
        ano: d.ano,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTADO');
  console.log('='.repeat(60));
  console.log(`✅ Atualizadas: ${success}`);
  console.log(`❌ Falhas: ${errors}`);
  if (failures.length > 0) {
    console.log('\nFalhas:');
    for (const f of failures) {
      console.log(`  ON ${f.numero}/${f.ano} (${f.id}): ${f.error}`);
    }
  }

  // Salva log da aplicação
  const logPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-ons-apply-log.json`
  );
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        appliedAt: new Date().toISOString(),
        candidatos: candidatos.length,
        success,
        errors,
        failures,
      },
      null,
      2
    )
  );
  console.log(`\n📄 Log: ${logPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
