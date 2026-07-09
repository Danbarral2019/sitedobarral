/**
 * BIA-5 — Backfill dos Informativos TCU faltantes a partir do CSV de dados
 * abertos. Usa o mesmo pipeline do cron `sync-tcu-informativos`
 * (scrapeNewInformativos → dedup por número → insert). Idempotente: rodar de
 * novo não duplica (o dedup por número filtra os já presentes).
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx scripts/backfill-tcu-informativos.ts --dry
 *   npx dotenv -e .env.local -- tsx scripts/backfill-tcu-informativos.ts
 *
 * Após inserir, indexar embeddings:
 *   npx dotenv -e .env.local -- tsx scripts/migrate-to-embeddings.ts --category informativo
 */
import { scrapeNewInformativos } from '@/lib/tcu-informativo-scraper';
import { prisma } from '@/lib/prisma';

async function main() {
  const dry = process.argv.includes('--dry');
  const limit = 50;

  const r = await scrapeNewInformativos({ limit });
  console.log(`[backfill] fonte=${r.source} · scrapeados=${r.totalScraped} · novos=${r.newItems.length} · duplicados=${r.duplicates}`);
  if (r.error) console.log(`[backfill] aviso: ${r.error}`);
  if (r.newItems.length === 0) { console.log('[backfill] nada a inserir.'); return; }

  if (dry) {
    console.log('\n[backfill] DRY-RUN — seria inserido:');
    r.newItems.forEach(i => console.log(`  [${i.numero}] ${i.titulo.slice(0, 90)}`));
    return;
  }

  let imported = 0, errors = 0;
  for (const item of r.newItems) {
    try {
      const tags = ['TCU', 'Informativo', 'Jurisprudência Selecionada'];
      if (item.numero) tags.push(item.numero);
      await prisma.document.create({
        data: {
          title: item.titulo,
          description: item.enunciado || item.titulo,
          content: item.enunciado || null,
          url: item.url || item.linkPdf || '',
          type: 'link',
          category: 'informativo',
          courseId: null,
          isCommon: true,
          isPublic: true,
          reviewed: true,
          reviewedAt: new Date(),
          reviewedBy: 'bia5-backfill-csv',
          tags: JSON.stringify(tags),
          tcuLinkPDF: item.linkPdf || null,
          tcuEnriquecidoEm: new Date(),
          tcuEnriquecimentoStatus: 'success',
          embeddingStatus: 'pending',
          metaTcu: {
            create: {
              linkPDF: item.linkPdf || null,
              enriquecidoEm: new Date(),
              enriquecimentoStatus: 'success',
            },
          },
        },
      });
      imported++;
      console.log(`  + ${item.titulo.slice(0, 75)}`);
    } catch (e) {
      errors++;
      console.error(`  ERRO [${item.numero}]: ${String(e).slice(0, 160)}`);
    }
  }
  console.log(`\n[backfill] Inseridos: ${imported} · erros: ${errors} (embeddingStatus='pending' — indexar em seguida)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
