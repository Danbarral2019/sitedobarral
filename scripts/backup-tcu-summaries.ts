/**
 * Backup de resumos e descrições atuais dos acórdãos TCU.
 *
 * Gera um snapshot JSON em `data/backups/tcu-summaries-<timestamp>.json`
 * antes de qualquer operação que sobrescreva `Document.summary` /
 * `Document.description` (ex.: Fase 5 do ROADMAP_GEMINI_PAGO.md).
 *
 * Uso:
 *   npx tsx scripts/backup-tcu-summaries.ts
 */

import { prisma } from '../lib/prisma';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  console.log('📦 Backup de resumos TCU — iniciando...');

  const docs = await prisma.document.findMany({
    where: { category: 'acordao' },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      summaryGeneratedAt: true,
      leiArticles: true,
      embeddingStatus: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  console.log(`   ${docs.length} acórdãos encontrados.`);

  const backupDir = join(process.cwd(), 'data', 'backups');
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `tcu-summaries-${stamp}.json`;
  const fullPath = join(backupDir, filename);

  const payload = {
    createdAt: new Date().toISOString(),
    count: docs.length,
    docs,
  };

  writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`✅ Backup salvo em: ${fullPath}`);
  console.log(`   Registros: ${docs.length}`);
}

main()
  .catch((err) => {
    console.error('❌ Backup falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
