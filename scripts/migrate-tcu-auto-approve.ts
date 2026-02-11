/**
 * Script de migração única: aprovar automaticamente todos os acórdãos TCU existentes
 *
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/migrate-tcu-auto-approve.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Migration] Aprovando acórdãos TCU existentes...');

  const result = await prisma.document.updateMany({
    where: {
      category: 'acordao',
      reviewed: false,
    },
    data: {
      reviewed: true,
      isPublic: true,
      reviewedBy: 'auto-migration',
      reviewedAt: new Date(),
    },
  });

  console.log(`[Migration] ${result.count} acórdãos TCU aprovados automaticamente.`);
}

main()
  .catch((e) => {
    console.error('[Migration] Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
