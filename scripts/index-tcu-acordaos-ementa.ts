import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { processDocuments } from '../lib/embeddings/document-processor';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const candidates = await prisma.document.findMany({
    where: { category: 'acordao', embeddingStatus: 'pending' },
    select: {
      id: true, title: true, content: true, tcuEmentaCompleta: true,
      _count: { select: { chunks: true } },
    },
  });

  // content vazio (null ou whitespace) E sem chunks E com ementa oficial disponível
  const target = candidates.filter(
    (d) => !(d.content && d.content.trim().length > 0) &&
           d._count.chunks === 0 &&
           !!(d.tcuEmentaCompleta && d.tcuEmentaCompleta.trim().length >= 50)
  );

  console.log(`Acórdãos pending: ${candidates.length}`);
  console.log(`Alvo (content vazio, 0 chunks, ementa oficial >=50 chars): ${target.length}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhuma alteração. Amostra:');
    target.slice(0, 5).forEach((d) => console.log(`  - ${d.title}`));
    return;
  }

  const results = await processDocuments(target.map((d) => d.id), {}, 5);
  const ok = results.filter((r) => r.success).length;
  const fail = results.length - ok;
  console.log(`\nProcessados: ${results.length} | sucesso: ${ok} | falha: ${fail}`);
  if (fail > 0) {
    results.filter((r) => !r.success).slice(0, 10).forEach((r) => console.log(`  FALHA ${r.documentId}: ${r.error}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
