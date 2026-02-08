/**
 * Indexação dos atos normativos (LegislativeAct) no pgvector
 *
 * Cria um registro Document para cada LegislativeAct no banco,
 * permitindo busca semântica junto com os demais documentos.
 * Após criar os docs, rodar migrate-to-embeddings.ts para gerar embeddings.
 *
 * Uso:
 *   cd sitedobarral
 *   export $(grep DATABASE_URL .env.local | xargs)
 *   npx tsx scripts/index-legislative-acts.ts
 *   npx tsx scripts/index-legislative-acts.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

async function main() {
  console.log('⚖️  Indexação dos atos normativos (LegislativeAct)\n');
  console.log(`   Opções: dry-run=${DRY_RUN}, force=${FORCE}`);

  // Buscar todos os atos normativos
  const acts = await prisma.legislativeAct.findMany({
    orderBy: { publishDate: 'desc' },
  });

  console.log(`   Total de atos normativos: ${acts.length}\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const act of acts) {
    const title = act.fullNumber;

    // Verificar duplicata
    const existing = await prisma.document.findFirst({
      where: { title, category: 'ato-normativo' },
    });

    if (existing && !FORCE) {
      skipped++;
      continue;
    }

    // Conteúdo = ementa do ato
    const content = act.ementa || '';
    if (content.length < 30) {
      console.log(`   ⚠️  ${title}: ementa muito curta (${content.length} chars), pulando`);
      skipped++;
      continue;
    }

    // Description: tipo + emissor + artigos vinculados
    const descParts: string[] = [];
    const typeLabels: Record<string, string> = {
      decreto: 'Decreto',
      portaria: 'Portaria',
      in: 'Instrução Normativa',
      'ordem-servico': 'Ordem de Serviço',
      lei: 'Lei',
      'medida-provisoria': 'Medida Provisória',
    };
    descParts.push(typeLabels[act.type] || act.type);
    descParts.push(`Emissor: ${act.issuer}`);

    // Parse leiArticles do ato
    let leiArticles: string[] = [];
    if (act.leiArticles) {
      try {
        leiArticles = JSON.parse(act.leiArticles);
      } catch {
        leiArticles = act.leiArticles.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (leiArticles.length > 0) {
      descParts.push(`Artigos da Lei 14.133: ${leiArticles.join(', ')}`);
    }

    const description = descParts.join(' — ');
    const url = act.officialUrl || '';

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Criaria: ${title} (${content.length} chars)`);
      created++;
      continue;
    }

    try {
      if (existing && FORCE) {
        await prisma.document.update({
          where: { id: existing.id },
          data: {
            content,
            description,
            url,
            leiArticles: leiArticles.length > 0 ? JSON.stringify(leiArticles) : null,
            embeddingStatus: 'pending',
          },
        });
      } else {
        await prisma.document.create({
          data: {
            title,
            description,
            type: 'link',
            url,
            category: 'ato-normativo',
            isCommon: true,
            isPublic: false,
            content,
            leiArticles: leiArticles.length > 0 ? JSON.stringify(leiArticles) : null,
            embeddingStatus: 'pending',
          },
        });
      }
      created++;
    } catch (err) {
      console.error(`   ❌ Erro ao criar ${title}:`, (err as Error).message);
      errors++;
    }
  }

  console.log('\n📊 Resultado:');
  console.log(`   ✅ Criados/atualizados: ${created}`);
  console.log(`   ⏭️  Pulados (já existiam): ${skipped}`);
  console.log(`   ❌ Erros: ${errors}`);

  if (!DRY_RUN && created > 0) {
    console.log('\n🔔 Próximo passo: rodar embeddings');
    console.log('   npx tsx scripts/migrate-to-embeddings.ts');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
