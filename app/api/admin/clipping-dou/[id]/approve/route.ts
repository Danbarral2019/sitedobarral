import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { scrapeContent } from '@/lib/dou-scraper';
import { LeiIndexer } from '@/lib/lei-indexer';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';
import { extractIssuerFromDouHierarchy } from '@/lib/dou-issuer';
import { getHierarchyLevel } from '@/lib/legislative-acts/hierarchy';

export const runtime = 'nodejs';
export const maxDuration = 120;

// hierarchyLevel via getHierarchyLevel() — fonte canônica.

const VALID_ACT_TYPES = new Set(['decreto', 'portaria', 'in', 'lei', 'mp', 'on']);

type ActType = 'decreto' | 'portaria' | 'in' | 'lei' | 'mp' | 'on';

/**
 * Schedules a promise to run after the response is sent.
 * Uses Next.js `after()` when available (request scope); falls back to bare
 * `void` outside a request scope (e.g. unit tests). The bare-void fallback
 * loses the post-response guarantee, but is acceptable in tests since the
 * mocked promises resolve immediately.
 */
function runAfterResponse(promise: Promise<unknown>): void {
  try {
    after(promise);
  } catch {
    void promise;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { id } = await params;
  const staging = await prisma.dOUStagingDocument.findUnique({ where: { id } });
  if (!staging) return NextResponse.json({ error: 'Staging não encontrado' }, { status: 404 });
  if (staging.finalDecision || staging.imported) {
    return NextResponse.json({ error: `Já ${staging.finalDecision || 'importado'}` }, { status: 409 });
  }

  let parsedDate: Date | undefined;
  try {
    const [d, m, y] = (staging.publishDate || '').split('/').map(Number);
    if (d && m && y) parsedDate = new Date(y, m - 1, d);
  } catch {
    /* noop */
  }

  const cleanTitle = staging.title;
  const atoType = staging.editorialActType as ActType | null;
  const safeActType: ActType | null = atoType && VALID_ACT_TYPES.has(atoType) ? atoType : null;
  if (atoType && !safeActType) {
    console.warn(
      `[clipping-dou approve] Invalid editorialActType "${atoType}" on staging ${id}, treating as null`,
    );
  }
  const issuer = extractIssuerFromDouHierarchy(staging.hierarchyStr || '');
  let actIdToScrape: string | null = null;

  const documentId = await prisma.$transaction(async (tx) => {
    const newDoc = await tx.document.create({
      data: {
        title: cleanTitle,
        description: staging.abstract,
        type: 'link',
        url: staging.url,
        category: 'legislacao',
        isPublic: true,
        tags: JSON.stringify(['ato_normativo', safeActType || 'outro'].filter(Boolean)),
        content: staging.abstract,
        douUrl: staging.url,
        douData: parsedDate,
        douSecao: staging.section,
        reviewed: true,
        reviewedAt: new Date(),
        reviewedBy: adminCheck.user.email,
        embeddingStatus: 'pending',
        metaDou: { create: { url: staging.url, data: parsedDate, secao: staging.section } },
      },
      select: { id: true },
    });

    if (safeActType) {
      const numberMatch = cleanTitle.match(
        /(?:decreto|portaria|instrução\s+normativa|in|lei|medida\s+provisória)\s+(?:[\w/]+\s+)?n[ºo°]?\s*([\d.]+(?:\/\d{4})?)/i,
      );
      const number = numberMatch ? numberMatch[1] : '';
      const yearMatch = cleanTitle.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

      if (number) {
        const fullNumber = `${safeActType === 'in' ? 'IN' : safeActType === 'on' ? 'ON' : safeActType === 'mp' ? 'MP' : safeActType.charAt(0).toUpperCase() + safeActType.slice(1)} ${number}/${year}`;
        const existing = await tx.legislativeAct.findUnique({ where: { fullNumber } });
        if (!existing) {
          const newAct = await tx.legislativeAct.create({
            data: {
              type: safeActType,
              number,
              year,
              fullNumber,
              title: cleanTitle,
              ementa: staging.abstract || cleanTitle,
              issuer,
              publishDate: parsedDate || new Date(),
              hierarchyLevel: getHierarchyLevel(safeActType),
              officialUrl: staging.url,
              createdBy: 'clipping-dou-approve',
            },
            select: { id: true },
          });
          actIdToScrape = newAct.id;
        }
      }
    }

    await tx.dOUStagingDocument.update({
      where: { id },
      data: {
        finalDecision: 'approved',
        imported: true,
        importedAt: new Date(),
        documentId: newDoc.id,
        reviewedAt: new Date(),
        reviewedBy: adminCheck.user.email,
        classificationCorrect: true,
      },
    });

    return newDoc.id;
  });

  // Pós-transação (background): scrape do conteúdo, scrape+index do ato, e LeiIndexer
  // (este último era 2-15s de Gemini segurando locks Postgres dentro da txn).
  runAfterResponse(
    scrapeContent(staging.url)
      .then(async (enriched) => {
        if (enriched && enriched.caracteres > 0) {
          const content =
            enriched.conteudo.length > 50_000
              ? enriched.conteudo.substring(0, 50_000) + '\n\n[... truncado]'
              : enriched.conteudo;
          await prisma.document.update({ where: { id: documentId }, data: { content } });
        }
      })
      .catch((e) => console.error('[clipping-dou approve] scrapeContent falhou:', e)),
  );

  if (actIdToScrape) {
    runAfterResponse(
      scrapeAndIndexAct(actIdToScrape).catch((e) =>
        console.error('[clipping-dou approve] scrapeAndIndexAct falhou:', e),
      ),
    );
  }

  runAfterResponse(
    (async () => {
      try {
        const analysis = await LeiIndexer.analyzeDocument({
          id: documentId,
          title: cleanTitle,
          category: 'legislacao',
          tags: JSON.stringify([safeActType]),
          content: staging.abstract,
          description: staging.abstract,
        });
        if (analysis.articles.length > 0) {
          const articleNumbers = LeiIndexer.resultToLeiArticles(analysis);
          await prisma.document.update({
            where: { id: documentId },
            data: { leiArticles: JSON.stringify(articleNumbers) },
          });
        }
      } catch (e) {
        console.error('[clipping-dou approve] LeiIndexer falhou:', e);
      }
    })(),
  );

  return NextResponse.json({ success: true, documentId, actId: actIdToScrape });
}
