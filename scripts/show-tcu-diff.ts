/**
 * Mostra diff antes/depois dos 5 acórdãos TCU reprocessados na Fase 5 smoke test.
 * Compara o backup mais recente em data/backups/ com o estado atual do banco.
 */

import { prisma } from '../lib/prisma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const backupDir = join(process.cwd(), 'data', 'backups');
  const files = readdirSync(backupDir)
    .filter(f => f.startsWith('tcu-summaries-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('Sem backup.'); return;
  }

  const backupPath = join(backupDir, files[0]);
  console.log(`Backup base: ${files[0]}`);
  console.log('');

  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));

  // Os 5 mais recentes reprocessados (order by summaryGeneratedAt DESC, limit 5)
  const current = await prisma.document.findMany({
    where: {
      category: 'acordao',
      summaryGeneratedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      summaryGeneratedAt: true,
    },
    orderBy: { summaryGeneratedAt: 'desc' },
    take: 5,
  });

  for (const doc of current) {
    const old = backup.docs.find((d: { id: string }) => d.id === doc.id);
    console.log('━'.repeat(70));
    console.log(`${doc.title}`);
    console.log('━'.repeat(70));

    console.log('\n[ANTES] summary:');
    console.log(`  ${old?.summary ?? '(vazio)'}`);

    console.log('\n[ANTES] description:');
    console.log(`  ${(old?.description ?? '(vazio)').slice(0, 400)}${
      (old?.description ?? '').length > 400 ? '...' : ''
    }`);

    console.log('\n[DEPOIS] summary (= description agora):');
    console.log(`  ${doc.summary ?? '(vazio)'}`);

    console.log('\n');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
