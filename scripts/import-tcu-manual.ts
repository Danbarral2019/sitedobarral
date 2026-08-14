/**
 * Script de importação do Manual TCU "Licitações & Contratos"
 *
 * Faz scraping de todas as seções do manual publicado em
 * licitacoesecontratos.tcu.gov.br e importa como Documents.
 *
 * Uso:
 *   npx tsx scripts/import-tcu-manual.ts --dry-run        # Simular
 *   npx tsx scripts/import-tcu-manual.ts --limit 5         # Testar com poucas
 *   npx tsx scripts/import-tcu-manual.ts                   # Importar todas
 *   npx tsx scripts/import-tcu-manual.ts --force           # Reimportar (atualizar existentes)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  MANUAL_SECTIONS,
  scrapeManualPage,
  fetchManualUpdateDate,
} from '../lib/tcu-manual-scraper';

// A versao corrente do Prisma exige adaptador; sem ele o script morria na
// construcao do cliente, como se apurou em 14 de agosto de 2026.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;
const DELAY_MS = 1000; // 1s between requests

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Importação Manual TCU "Licitações & Contratos" ===');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'PRODUÇÃO'}`);
  if (FORCE) console.log('Flag --force: atualizará documentos existentes');
  if (LIMIT) console.log(`Limite: ${LIMIT} seções`);

  // 1. Fetch manual update date
  console.log('\n[1/3] Buscando data de atualização do manual...');
  const manualVersion = await fetchManualUpdateDate();
  console.log(`  Data do manual: ${manualVersion || '(não encontrada)'}`);

  // 2. Get sections to process
  const sections = LIMIT ? MANUAL_SECTIONS.slice(0, LIMIT) : MANUAL_SECTIONS;
  console.log(`\n[2/3] Processando ${sections.length} seções (de ${MANUAL_SECTIONS.length} total)...\n`);

  // 3. Check existing docs
  const existingDocs = await prisma.document.findMany({
    where: { category: 'manual-tcu' },
    select: { id: true, url: true, aiClassification: true },
  });
  const existingByUrl = new Map(existingDocs.map(d => [d.url, d]));
  console.log(`  ${existingDocs.length} documentos manual-tcu já existem no banco\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let totalArticles = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const progress = `[${i + 1}/${sections.length}]`;

    try {
      const scraped = await scrapeManualPage(section);

      if (!scraped) {
        console.log(`${progress} ⚠️  ${section.sectionNumber} ${section.title} — sem conteúdo`);
        errors++;
        if (i < sections.length - 1) await sleep(DELAY_MS);
        continue;
      }

      const existing = existingByUrl.get(scraped.url);
      totalArticles += scraped.leiArticles.length;

      if (existing && !FORCE) {
        console.log(`${progress} ⏭️  ${section.sectionNumber} ${section.title} — já existe`);
        skipped++;
        if (i < sections.length - 1) await sleep(DELAY_MS);
        continue;
      }

      const docTitle = section.sectionNumber
        ? `Manual TCU - ${section.sectionNumber} ${section.title}`
        : `Manual TCU - ${section.title}`;
      const tags = JSON.stringify(['TCU', 'Manual', '5ª Edição', section.sectionNumber].filter(Boolean));
      // A coluna JSON `leiArticles` foi derrubada na onda 4.5 em favor do array
      // nativo `leiArticlesArr`. O script continuava gravando a antiga, e por
      // isso toda criacao falhava, com mensagem vazia, ate 14 de agosto de 2026.
      const leiArticlesArr = scraped.leiArticles.map(String);
      const aiClassification = JSON.stringify({
        source: 'tcu-manual-scraper',
        contentHash: scraped.contentHash,
        manualVersion: manualVersion || 'unknown',
        sectionNumber: section.sectionNumber,
      });

      if (DRY_RUN) {
        // O ensaio conta o que faria. Ate 14 de agosto de 2026 ele apenas
        // imprimia a linha e nao incrementava contador algum, de modo que o
        // resumo dizia "criados: 0" com 48 secoes por criar: nao servia para
        // conferir o que mudaria, que e a unica razao de existir do ensaio.
        if (existing) updated++;
        else created++;
        console.log(
          `${progress} 📝  ${docTitle}` +
          ` (${scraped.content.length} chars, ${scraped.leiArticles.length} artigos: [${scraped.leiArticles.join(', ')}])`
        );
      } else if (existing && FORCE) {
        // Update existing document
        await prisma.document.update({
          where: { id: existing.id },
          data: {
            title: docTitle,
            description: scraped.description,
            content: scraped.content,
            tags,
            leiArticlesArr,
            aiClassification,
            embeddingStatus: 'pending',
          },
        });
        console.log(`${progress} 🔄  ${docTitle} — atualizado`);
        updated++;
      } else {
        // Create new document
        await prisma.document.create({
          data: {
            title: docTitle,
            description: scraped.description,
            content: scraped.content,
            url: scraped.url,
            type: 'link',
            category: 'manual-tcu',
            isCommon: true,
            isPublic: false,
            reviewed: false,
            tags,
            leiArticlesArr,
            aiClassification,
            embeddingStatus: 'pending',
          },
        });
        console.log(`${progress} ✅  ${docTitle} — criado`);
        created++;
      }
    } catch (err) {
      console.error(
        `${progress} ❌  ${section.sectionNumber} ${section.title}: ${err instanceof Error ? (err.message || err.name) : err}`, err
      );
      errors++;
    }

    // Delay between requests
    if (i < sections.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log('\n=== Resultado ===');
  console.log(`Total seções processadas: ${sections.length}`);
  console.log(`Criados: ${created}`);
  console.log(`Atualizados: ${updated}`);
  console.log(`Já existentes (skipped): ${skipped}`);
  console.log(`Erros/sem conteúdo: ${errors}`);
  console.log(`Total artigos Lei 14.133 encontrados: ${totalArticles}`);
  console.log(`Versão do manual: ${manualVersion || '(não encontrada)'}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — nenhum dado foi salvo no banco.');
    console.log('Para importar de fato, execute sem --dry-run');
  } else if (created > 0 || updated > 0) {
    console.log('\n📌 Próximo passo: rodar embeddings');
    console.log('   npx tsx scripts/migrate-to-embeddings.ts');
  }
}

main()
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
