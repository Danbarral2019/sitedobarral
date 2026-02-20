import { NextRequest, NextResponse } from 'next/server';
import { dataJudSTJScraper } from '@/lib/tribunal-scrapers/datajud';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];

  // STJ (unico tribunal superior disponivel na API publica do DataJud)
  try {
    const stjResult = await dataJudSTJScraper.scrape({ maxItems: 30 });
    results.push(stjResult);
  } catch (error) {
    results.push({ scraperCode: 'stj', error: error instanceof Error ? error.message : String(error) });
  }

  return NextResponse.json({ results });
}
