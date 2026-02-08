/**
 * Indexação dos artigos da Lei 14.133/2021 no pgvector
 *
 * Cria 195 registros Document (um por artigo) para busca semântica.
 * Após criar os docs, rodar migrate-to-embeddings.ts para gerar embeddings.
 *
 * Uso:
 *   cd sitedobarral
 *   export $(grep DATABASE_URL .env.local | xargs)
 *   npx tsx scripts/index-lei-artigos.ts
 *   npx tsx scripts/index-lei-artigos.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

async function main() {
  console.log('📜 Indexação dos artigos da Lei 14.133/2021\n');
  console.log(`   Opções: dry-run=${DRY_RUN}, force=${FORCE}`);

  const artigos = Object.values(LEI_14133_ARTIGOS);
  console.log(`   Total de artigos: ${artigos.length}\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const artigo of artigos) {
    const title = `Art. ${artigo.numero} - Lei 14.133/2021`;
    const url = `/area-restrita/artigo/${artigo.numero}`;

    // Verificar duplicata
    const existing = await prisma.document.findFirst({
      where: { title, category: 'lei-artigo' },
    });

    if (existing && !FORCE) {
      skipped++;
      continue;
    }

    // Montar description com capítulo + seção
    const descParts: string[] = [];
    if (artigo.titulo) descParts.push(artigo.titulo);
    if (artigo.capituloCompleto) descParts.push(artigo.capituloCompleto);
    if (artigo.secao) descParts.push(artigo.secao);
    const description = descParts.join(' — ') || artigo.capitulo;

    // Conteúdo = texto completo do artigo (ementa)
    const content = artigo.ementa;

    if (content.length < 50) {
      console.log(`   ⚠️  Art. ${artigo.numero}: texto muito curto (${content.length} chars), pulando`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Criaria: ${title} (${content.length} chars)`);
      created++;
      continue;
    }

    try {
      if (existing && FORCE) {
        // Atualizar doc existente
        await prisma.document.update({
          where: { id: existing.id },
          data: {
            content,
            description,
            url,
            embeddingStatus: 'pending', // forçar re-embedding
          },
        });
      } else {
        // Criar novo doc
        await prisma.document.create({
          data: {
            title,
            description,
            type: 'link',
            url,
            category: 'lei-artigo',
            isCommon: true,
            isPublic: false,
            content,
            leiArticles: JSON.stringify([artigo.numero]),
            embeddingStatus: 'pending',
          },
        });
      }
      created++;
    } catch (err) {
      console.error(`   ❌ Erro ao criar Art. ${artigo.numero}:`, (err as Error).message);
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
