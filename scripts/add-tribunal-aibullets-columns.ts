/**
 * Migration cirúrgica: adiciona aiBullets + aiGeneratedAt em TribunalDecision.
 *
 * Usada porque o banco tem drift (colunas leiArticlesArr/leiIndexedAt/leiIndexerError
 * órfãs sem referência no schema.prisma) que bloqueiam `prisma db push`. Esta
 * migration é compatível: usa IF NOT EXISTS, não destrutiva, reversível com
 * DROP COLUMN.
 *
 * Uso: npx tsx scripts/add-tribunal-aibullets-columns.ts
 */
import { prisma } from '../lib/prisma';

async function main() {
  console.log('[migration] Aplicando ALTER TABLE em TribunalDecision...');
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "TribunalDecision" ADD COLUMN IF NOT EXISTS "aiBullets" TEXT;'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "TribunalDecision" ADD COLUMN IF NOT EXISTS "aiGeneratedAt" TIMESTAMP(3);'
  );

  // Verifica via SELECT explícito nas novas colunas — se rodar sem erro, existem.
  const sample = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "TribunalDecision" WHERE "aiBullets" IS NULL AND "aiGeneratedAt" IS NULL;`
  );
  console.log(`[migration] OK — colunas aiBullets + aiGeneratedAt acessíveis. ${sample[0].count} registros sem cache (esperado: total da tabela, já que ninguém preencheu ainda).`);
}

main()
  .catch((e) => {
    console.error('[migration] ERRO:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
