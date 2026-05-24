/**
 * Invoca o handler GET de /api/cron/daily-clipping em modo dry-run, sem subir
 * dev server. Útil para validar a Fase 4 sem efeitos colaterais (não persiste
 * DailyClippingSend, não chama Resend).
 *
 * Override de env vars no comando:
 *   CLIPPING_TRIBUNAIS_ENABLED=TCU,TCE-PE npx tsx scripts/test-daily-clipping-dryrun.ts
 */
import { NextRequest } from 'next/server';

async function main() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET ausente no env.');
    process.exit(1);
  }

  console.log('[dry-run] Configuração:');
  console.log('  CLIPPING_TRIBUNAIS_ENABLED =', process.env.CLIPPING_TRIBUNAIS_ENABLED || '(default: TCU)');
  console.log('  CLIPPING_WINDOW_DAYS       =', process.env.CLIPPING_WINDOW_DAYS || '(default: 14)');
  console.log('  CLIPPING_MAX_ITEMS_PER_TRIBUNAL =', process.env.CLIPPING_MAX_ITEMS_PER_TRIBUNAL || '(default: 5)');
  console.log('  CLIPPING_MAX_ITEMS_TOTAL   =', process.env.CLIPPING_MAX_ITEMS_TOTAL || '(default: 15)');
  console.log();

  const { GET } = await import('../app/api/cron/daily-clipping/route');

  const req = new NextRequest('http://localhost:3000/api/cron/daily-clipping?dryRun=true', {
    method: 'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  const res = await GET(req);
  const body = await res.json();

  console.log('\n[dry-run] HTTP', res.status);
  console.log(JSON.stringify(body, null, 2));
}

main().catch((e) => {
  console.error('[dry-run] ERRO:', e);
  process.exit(1);
});
