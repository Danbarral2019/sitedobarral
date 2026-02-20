import { NextRequest, NextResponse } from 'next/server';
import { dataJudSTJScraper, dataJudSTFScraper } from '@/lib/tribunal-scrapers/datajud';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];

  // STJ
  try {
    const stjResult = await dataJudSTJScraper.scrape({ maxItems: 30 });
    results.push(stjResult);
  } catch (error) {
    results.push({ scraperCode: 'stj', error: error instanceof Error ? error.message : String(error) });
  }

  // STF
  try {
    const stfResult = await dataJudSTFScraper.scrape({ maxItems: 30 });
    results.push(stfResult);
  } catch (error) {
    results.push({ scraperCode: 'stf', error: error instanceof Error ? error.message : String(error) });
  }

  return NextResponse.json({ results });
}
