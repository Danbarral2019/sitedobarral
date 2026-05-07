import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { renderDailyClipping, type ClippingAcordao } from '../lib/email-templates/daily-clipping';
import { signUnsubscribeToken } from '../lib/clipping/unsubscribe-token';
import { signViewToken } from '../lib/clipping/view-token';
import { formatSentDateParam, startOfBrasiliaDay } from '../lib/clipping/archive';

function parseArgs(argv: string[]): { date?: string; to?: string; name?: string; dryRun: boolean } {
  const out: { date?: string; to?: string; name?: string; dryRun: boolean } = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--date=')) out.date = arg.slice('--date='.length);
    else if (arg === '--date') out.date = argv[++i];
    else if (arg.startsWith('--to=')) out.to = arg.slice('--to='.length);
    else if (arg === '--to') out.to = argv[++i];
    else if (arg.startsWith('--name=')) out.name = arg.slice('--name='.length);
    else if (arg === '--name') out.name = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.date || !args.to) {
    console.error('Uso: npx tsx scripts/resend-clipping.ts --date YYYY-MM-DD --to email@x.com [--name "Nome"] [--dry-run]');
    console.error('A data corresponde ao sentDate (dia em que o cron rodou, BRT).');
    process.exit(1);
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(args.date);
  if (!dateMatch) {
    console.error('Formato de data inválido. Use YYYY-MM-DD.');
    process.exit(1);
  }
  const [, y, m, d] = dateMatch;
  const sentDateKey = startOfBrasiliaDay(new Date(`${y}-${m}-${d}T12:00:00Z`));

  const send = await prisma.dailyClippingSend.findUnique({ where: { sentDate: sentDateKey } });
  if (!send) {
    console.error(`Nenhum DailyClippingSend encontrado para sentDate=${sentDateKey.toISOString()}`);
    process.exit(1);
  }

  const acordaoIds: string[] = JSON.parse(send.acordaoIdsIncluded || '[]');
  if (acordaoIds.length === 0) {
    console.error(`DailyClippingSend ${send.id} não tem acordaoIdsIncluded.`);
    process.exit(1);
  }

  const docs = await prisma.document.findMany({
    where: { id: { in: acordaoIds } },
    select: {
      id: true,
      title: true,
      description: true,
      url: true,
      tcuNumeroAcordao: true,
      tcuEmentaCompleta: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuLinkPDF: true,
      tcuDataJulgamento: true,
      clippingExtract: { select: { dispositivos: true, extractMethod: true, aiBullets: true } },
    },
  });

  const docMap = new Map(docs.map((d) => [d.id, d]));
  const acordaos: ClippingAcordao[] = acordaoIds
    .map((id) => docMap.get(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((c) => ({
      documentId: c.id,
      numeroAcordao: c.tcuNumeroAcordao || c.title || '',
      colegiado: c.tcuOrgaoJulgador || 'TCU',
      relator: c.tcuRelator,
      dataSessao: c.tcuDataJulgamento,
      ementa: (c.tcuEmentaCompleta || c.description || '').trim(),
      linkPdf: c.tcuLinkPDF,
      linkInternal: c.url,
      dispositivos: (c.clippingExtract?.dispositivos as ClippingAcordao['dispositivos'] | undefined) || [],
      extractMethod: (c.clippingExtract?.extractMethod as ClippingAcordao['extractMethod'] | undefined) || 'failed',
      aiBullets: (() => {
        const raw = c.clippingExtract?.aiBullets;
        if (!raw) return undefined;
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter((s: unknown): s is string => typeof s === 'string') : undefined;
        } catch { return undefined; }
      })(),
    }));

  const referenceDate = new Date(sentDateKey.getTime() - 24 * 60 * 60 * 1000);
  const adminUserId = `admin:${args.to.toLowerCase()}`;
  const sentDateParam = formatSentDateParam(sentDateKey);

  const rendered = renderDailyClipping({
    sendId: `resend-${send.id}`,
    recipientName: args.name || args.to,
    unsubscribeToken: signUnsubscribeToken(adminUserId),
    referenceDate,
    acordaos,
    viewToken: signViewToken(sentDateParam),
    sentDateParam,
    showArchiveBanner: process.env.CLIPPING_NEW_FEATURE_BANNER === 'true',
  });

  console.log(`Reenvio do clipping de ${args.date} (sentDate=${sentDateKey.toISOString()})`);
  console.log(`  → para: ${args.to}`);
  console.log(`  → ${acordaos.length} acórdão(s) reconstruído(s) (de ${acordaoIds.length} salvos)`);
  console.log(`  → subject: ${rendered.subject}`);

  if (args.dryRun) {
    console.log('\n[DRY RUN] Email não enviado. HTML length:', rendered.html.length);
    return;
  }

  const result = await sendEmail({
    to: args.to,
    subject: `[Reenvio] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
  });

  if (result.success) {
    console.log('✓ Enviado com sucesso.');
  } else {
    console.error('✗ Falha ao enviar:', result.error);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
