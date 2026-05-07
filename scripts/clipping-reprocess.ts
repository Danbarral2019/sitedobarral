/**
 * Reprocessa os clipping extracts de envios antigos com o pipeline novo
 * (RTF + IA). Útil quando o pipeline mudou e você quer atualizar caches
 * antigos para o reenvio refletir a nova qualidade.
 *
 * Uso:
 *   npx tsx scripts/clipping-reprocess.ts --date 2026-05-06 --date 2026-05-07
 *   npx tsx scripts/clipping-reprocess.ts --last 5
 */
import { prisma } from '../lib/prisma';
import { extractDispositivos, type DocumentLike } from '../lib/clipping/dispositivo-extractor';
import { startOfBrasiliaDay } from '../lib/clipping/archive';

function parseArgs(argv: string[]): { dates: string[]; last?: number } {
  const dates: string[] = [];
  let last: number | undefined;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--date') dates.push(argv[++i]);
    else if (arg.startsWith('--date=')) dates.push(arg.slice('--date='.length));
    else if (arg === '--last') last = parseInt(argv[++i], 10);
    else if (arg.startsWith('--last=')) last = parseInt(arg.slice('--last='.length), 10);
  }
  return { dates, last };
}

async function main() {
  const args = parseArgs(process.argv);
  let sends: Array<{ sentDate: Date; acordaoIdsIncluded: string | null }> = [];

  if (args.dates.length > 0) {
    for (const dateStr of args.dates) {
      const sentDateKey = startOfBrasiliaDay(new Date(`${dateStr}T12:00:00Z`));
      const send = await prisma.dailyClippingSend.findUnique({
        where: { sentDate: sentDateKey },
        select: { sentDate: true, acordaoIdsIncluded: true },
      });
      if (send) sends.push(send);
    }
  } else if (args.last) {
    sends = await prisma.dailyClippingSend.findMany({
      where: { status: { in: ['success', 'partial'] }, acordaoCount: { gt: 0 } },
      orderBy: { sentDate: 'desc' },
      take: args.last,
      select: { sentDate: true, acordaoIdsIncluded: true },
    });
  } else {
    console.error('Uso: --date YYYY-MM-DD [--date ...] OU --last N');
    process.exit(1);
  }

  for (const s of sends) {
    const ids: string[] = s.acordaoIdsIncluded ? JSON.parse(s.acordaoIdsIncluded) : [];
    console.log(`\n=== ${s.sentDate.toISOString().slice(0, 10)} (${ids.length} acórdãos) ===`);
    if (ids.length === 0) continue;

    await prisma.clippingItemExtract.deleteMany({ where: { documentId: { in: ids } } });
    console.log(`  cache resetado`);

    const docs = await prisma.document.findMany({
      where: { id: { in: ids } },
      select: { id: true, tcuNumeroAcordao: true, tcuEmentaCompleta: true, tcuLinkPDF: true },
    });

    for (const d of docs) {
      const t0 = Date.now();
      const docLike: DocumentLike = {
        id: d.id,
        tcuEmentaCompleta: d.tcuEmentaCompleta,
        tcuLinkPDF: d.tcuLinkPDF,
        clippingExtract: null,
      };
      try {
        const r = await extractDispositivos(docLike);
        const elapsed = Date.now() - t0;
        console.log(
          `  ${d.tcuNumeroAcordao}: ${r.method} (${r.dispositivos.length} disp, ${r.aiBullets?.length ?? 0} bullets, ${elapsed}ms)`,
        );
      } catch (e) {
        console.error(`  ${d.tcuNumeroAcordao}: ERRO ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
