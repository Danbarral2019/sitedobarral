import { prisma } from '../lib/prisma';
import { extractDispositivos } from '../lib/clipping/dispositivo-extractor';

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'acordao' },
    select: {
      id: true,
      title: true,
      tcuNumeroAcordao: true,
      tcuEmentaCompleta: true,
      tcuLinkPDF: true,
      tcuDataJulgamento: true,
      clippingExtract: {
        select: { dispositivos: true, extractMethod: true, pdfFetchFailed: true },
      },
    },
    orderBy: { tcuDataJulgamento: 'desc' },
    take: 20,
  });

  console.log(`\n=== Smoke test: ${docs.length} acórdãos ===\n`);

  let okCount = 0;
  let failedCount = 0;
  const byMethod: Record<string, number> = {};

  for (const d of docs) {
    const start = Date.now();
    const r = await extractDispositivos({
      id: d.id,
      tcuEmentaCompleta: d.tcuEmentaCompleta,
      tcuLinkPDF: d.tcuLinkPDF,
      clippingExtract: d.clippingExtract ?? null,
    });
    const ms = Date.now() - start;
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
    if (r.dispositivos.length > 0) okCount++;
    else failedCount++;

    const head = `${d.tcuNumeroAcordao || d.title?.slice(0, 40)} (${ms}ms ${r.method})`;
    if (r.dispositivos.length > 0) {
      console.log(`✅ ${head} → ${r.dispositivos.length} dispositivo(s)`);
      console.log(`   ${r.dispositivos[0].numero}. ${r.dispositivos[0].texto.slice(0, 140)}...`);
    } else {
      console.log(`❌ ${head} → falhou${r.pdfFetchFailed ? ' (pdf inacessível)' : ''}`);
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`  OK:     ${okCount}/${docs.length} (${Math.round((okCount / docs.length) * 100)}%)`);
  console.log(`  Falha:  ${failedCount}/${docs.length}`);
  console.log(`  Por método:`, byMethod);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
