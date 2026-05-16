import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  MANUAL_SECTIONS,
  scrapeManualPage,
  fetchManualUpdateDate,
} from '@/lib/tcu-manual-scraper';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Cron Job: Sincronização mensal do Manual TCU "Licitações & Contratos"
 *
 * Verifica se o manual foi atualizado no site do TCU. Se sim, re-scrape
 * todas as páginas e atualiza documentos que mudaram (via contentHash).
 *
 * Quick check: compara data de atualização do manual com a armazenada.
 * Se não mudou, encerra sem processar páginas individuais.
 *
 * Segurança: Requer Authorization: Bearer <CRON_SECRET>
 * Agendamento: Mensal, dia 1 às 4h UTC (vercel.json)
 */

const DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const maxDuration = 300; // 5 minutes max for Vercel

export async function GET(request: NextRequest) {
  // 1. Auth check (fora do telemetry — auth não conta como falha de cron)
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('sync-tcu-manual', async () => {
      console.log('[Sync TCU Manual] Iniciando sincronização...');
      const startTime = Date.now();

    // 2. Quick check: compare update date
    const currentDate = await fetchManualUpdateDate();
    console.log(`[Sync TCU Manual] Data no site: ${currentDate || '(não encontrada)'}`);

    // Get stored version from any existing manual-tcu doc
    const sampleDoc = await prisma.document.findFirst({
      where: { category: 'manual-tcu' },
      select: { aiClassification: true },
    });

    let storedVersion: string | null = null;
    if (sampleDoc?.aiClassification) {
      try {
        const parsed = typeof sampleDoc.aiClassification === 'string'
          ? JSON.parse(sampleDoc.aiClassification)
          : sampleDoc.aiClassification;
        storedVersion = parsed.manualVersion || null;
      } catch { /* ignore parse errors */ }
    }

    console.log(`[Sync TCU Manual] Data armazenada: ${storedVersion || '(nenhuma)'}`);

    // If dates match and we have docs, skip
    if (currentDate && storedVersion === currentDate && sampleDoc) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Sync TCU Manual] Manual não mudou, encerrando (${elapsed}s)`);
      responseBody = {
        success: true,
        unchanged: true,
        manualVersion: currentDate,
        elapsed: `${elapsed}s`,
      };
      return { itemsFound: 0, metadata: { unchanged: true, manualVersion: currentDate } };
    }

    // 3. Full sync: re-scrape all pages
    console.log('[Sync TCU Manual] Detectada atualização — re-processando todas as seções...');

    const existingDocs = await prisma.document.findMany({
      where: { category: 'manual-tcu' },
      select: { id: true, url: true, aiClassification: true },
    });
    const existingByUrl = new Map(existingDocs.map(d => [d.url, d]));
    const processedUrls = new Set<string>();

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (let i = 0; i < MANUAL_SECTIONS.length; i++) {
      const section = MANUAL_SECTIONS[i];

      try {
        const scraped = await scrapeManualPage(section);
        if (!scraped) {
          errors++;
          if (i < MANUAL_SECTIONS.length - 1) await sleep(DELAY_MS);
          continue;
        }

        processedUrls.add(scraped.url);
        const existing = existingByUrl.get(scraped.url);

        // Check if content changed via hash
        let existingHash: string | null = null;
        if (existing?.aiClassification) {
          try {
            const parsed = typeof existing.aiClassification === 'string'
              ? JSON.parse(existing.aiClassification as string)
              : existing.aiClassification;
            existingHash = parsed.contentHash || null;
          } catch { /* ignore */ }
        }

        const docTitle = `Manual TCU - ${section.sectionNumber} ${section.title}`;
        const tags = JSON.stringify(['TCU', 'Manual', '5ª Edição', section.sectionNumber]);
        const leiArticlesJson = JSON.stringify(scraped.leiArticles);
        const aiClassification = JSON.stringify({
          source: 'tcu-manual-scraper',
          contentHash: scraped.contentHash,
          manualVersion: currentDate || storedVersion || 'unknown',
          sectionNumber: section.sectionNumber,
        });

        if (existing && existingHash === scraped.contentHash) {
          // Content unchanged — just update version metadata
          unchanged++;
        } else if (existing) {
          // Content changed — update
          await prisma.document.update({
            where: { id: existing.id },
            data: {
              title: docTitle,
              description: scraped.description,
              content: scraped.content,
              tags,
              leiArticles: leiArticlesJson,
              aiClassification,
              embeddingStatus: 'pending',
            },
          });
          updated++;
        } else {
          // New section
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
              leiArticles: leiArticlesJson,
              aiClassification,
              embeddingStatus: 'pending',
            },
          });
          created++;
        }
      } catch (err) {
        errors++;
        console.error(
          `[Sync TCU Manual] Erro ${section.sectionNumber}:`,
          err instanceof Error ? err.message : err
        );
      }

      if (i < MANUAL_SECTIONS.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    // 4. Check for removed sections
    let removed = 0;
    for (const [url, doc] of existingByUrl) {
      if (!processedUrls.has(url)) {
        const syncNote = `[Sync ${new Date().toISOString().slice(0, 10)}] Seção não encontrada no manual atual. Verificar se foi removida ou se a URL mudou.`;
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            reviewed: false,
            adminNotes: syncNote,
            // Satellite table (dual-write)
            notes: {
              upsert: {
                create: {
                  adminNotes: syncNote,
                  updatedAt: new Date(),
                  updatedBy: 'cron:sync-tcu-manual',
                },
                update: {
                  adminNotes: syncNote,
                  updatedAt: new Date(),
                  updatedBy: 'cron:sync-tcu-manual',
                },
              },
            },
          },
        });
        removed++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const result = {
      success: true,
      unchanged: false,
      manualVersion: currentDate,
      previousVersion: storedVersion,
      total: MANUAL_SECTIONS.length,
      created,
      updated,
      contentUnchanged: unchanged,
      removed,
      errors,
      elapsed: `${elapsed}s`,
    };

      console.log('[Sync TCU Manual] Resultado:', result);
      responseBody = {
        message: `Sync Manual TCU: ${created} criados, ${updated} atualizados, ${unchanged} sem mudança`,
        ...result,
      };

      return {
        itemsFound: MANUAL_SECTIONS.length,
        itemsNew: created + updated,
        itemsError: errors,
        metadata: {
          manualVersion: currentDate,
          previousVersion: storedVersion,
          contentUnchanged: unchanged,
          removed,
          elapsed: `${elapsed}s`,
        },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar Manual TCU',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
