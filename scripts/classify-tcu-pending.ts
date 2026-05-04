/**
 * Classifica acórdãos TCU sem tcuArea usando taxonomia oficial do TCU.
 *
 * Wrapper de batch sobre `lib/tcu-editorial-classifier.ts` (mesma lógica que o cron diário usa).
 *
 * Uso:
 *   npx tsx scripts/classify-tcu-pending.ts                # roda em todos pending
 *   npx tsx scripts/classify-tcu-pending.ts --limit 10     # piloto
 *   npx tsx scripts/classify-tcu-pending.ts --dry-run      # não salva no banco
 *
 * Persistência: tcuArea/tcuTema/tcuSubtema (Document) + classificadoEm/revisadoPorAdmin
 * (Document + DocumentMetaTcu satellite). Marca tcuRevisadoPorAdmin = false (admin valida depois).
 */

import { prisma } from '../lib/prisma';
import { classifyTCUEditorial } from '../lib/tcu-editorial-classifier';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.findIndex(a => a === '--limit');
const limit = limitArg >= 0 ? parseInt(args[limitArg + 1] || '0') : 0;

async function main() {
  if (dryRun) console.log('🟡 DRY RUN — nada será salvo no banco\n');

  const where = {
    category: 'acordao',
    tcuNumeroAcordao: { not: null },
    tcuArea: null,
  };

  const total = await prisma.document.count({ where });
  console.log(`Acórdãos pendentes de classificação: ${total}`);
  const toProcess = limit > 0 ? Math.min(limit, total) : total;
  console.log(`Vão ser processados: ${toProcess}\n`);

  const docs = await prisma.document.findMany({
    where,
    select: {
      id: true,
      tcuNumeroAcordao: true,
      title: true,
      description: true,
      tcuEmentaCompleta: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuDataJulgamento: true,
    },
    orderBy: { tcuDataJulgamento: 'desc' },
    take: toProcess,
  });

  let success = 0;
  let failed = 0;
  let novosTemas = 0;
  let novosSubtemas = 0;
  const examples: Array<{ acordao: string; area: string; tema: string; subtema: string | null; confianca: number }> = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const num = doc.tcuNumeroAcordao;
    process.stdout.write(`[${i + 1}/${docs.length}] ${num} ... `);

    try {
      const result = await classifyTCUEditorial({
        numeroAcordao: doc.tcuNumeroAcordao,
        title: doc.title,
        ementa: doc.tcuEmentaCompleta || doc.description || doc.title,
        relator: doc.tcuRelator,
        orgao: doc.tcuOrgaoJulgador,
      });

      if (result.novoTema) novosTemas++;
      if (result.novoSubtema) novosSubtemas++;

      if (!dryRun) {
        const now = new Date();
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            tcuArea: result.area,
            tcuTema: result.tema,
            tcuSubtema: result.subtema,
            tcuClassificadoEm: now,
            tcuRevisadoPorAdmin: false,
          },
        });
        await prisma.documentMetaTcu.upsert({
          where: { documentId: doc.id },
          create: {
            documentId: doc.id,
            area: result.area,
            tema: result.tema,
            subtema: result.subtema,
            classificadoEm: now,
            revisadoPorAdmin: false,
          },
          update: {
            area: result.area,
            tema: result.tema,
            subtema: result.subtema,
            classificadoEm: now,
            revisadoPorAdmin: false,
          },
        });
      }

      success++;
      const flagNovo = (result.novoTema ? ' 🆕tema' : '') + (result.novoSubtema ? ' 🆕subtema' : '');
      console.log(`OK [${result.area} > ${result.tema}${result.subtema ? ' > ' + result.subtema : ''}] (${result.confianca}%)${flagNovo}`);

      if (examples.length < 10) {
        examples.push({
          acordao: num || '?',
          area: result.area,
          tema: result.tema,
          subtema: result.subtema,
          confianca: result.confianca,
        });
      }

      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      failed++;
      console.log(`FALHA: ${err instanceof Error ? err.message.slice(0, 100) : err}`);
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Sucesso:           ${success}/${docs.length}`);
  console.log(`Falha:             ${failed}/${docs.length}`);
  console.log(`Novos temas IA:    ${novosTemas}`);
  console.log(`Novos subtemas IA: ${novosSubtemas}`);
  if (dryRun) console.log(`\n🟡 DRY RUN — nenhuma escrita no banco`);

  if (examples.length > 0) {
    console.log(`\n=== Amostra de classificações ===`);
    for (const ex of examples) {
      console.log(`  ${ex.acordao}: ${ex.area} > ${ex.tema}${ex.subtema ? ' > ' + ex.subtema : ''} (${ex.confianca}%)`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
