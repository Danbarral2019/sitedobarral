import { NextRequest, NextResponse } from 'next/server';
import { dataJudSTJScraper } from '@/lib/tribunal-scrapers/datajud';
import { withCronTelemetry } from '@/lib/cron-telemetry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Nota: dataJudSTJScraper já loga em ScraperHealthLog com scraperCode='stj'
  // (granular). withCronTelemetry adiciona um meta-log com scraperCode='sync-datajud'
  // monitorando a execução do cron como um todo (capture de erros que escapem do scraper).
  let responseBody: Record<string, unknown> = { results: [] };
  try {
    await withCronTelemetry('sync-datajud', async () => {
      const results: unknown[] = [];
      let totalErrors = 0;
      let totalNew = 0;

      try {
        const stjResult = await dataJudSTJScraper.scrape({ maxItems: 30 });
        results.push(stjResult);
        totalNew += (stjResult as { itemsNew?: number }).itemsNew ?? 0;
        totalErrors += ((stjResult as { errors?: unknown[] }).errors?.length) ?? 0;
      } catch (error) {
        results.push({ scraperCode: 'stj', error: error instanceof Error ? error.message : String(error) });
        totalErrors++;
      }

      responseBody = { results };
      return { itemsNew: totalNew, itemsError: totalErrors };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao sincronizar DataJud', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
