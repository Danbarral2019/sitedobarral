/**
 * Cron Job: Sincronização de Atos Normativos do DOU
 *
 * Busca atos normativos relevantes no DOU, filtra atos concretos,
 * auto-aprova atos de autoridades competentes (Presidência, MGI/SEGES),
 * detecta alterações na Lei 14.133 e em atos existentes.
 *
 * FLUXO:
 * 1. Auth (CRON_SECRET)
 * 2. Buscar DOU (searchLastWeek) → resultados brutos
 * 3. Classificar (DOUClassifier) → filtrar ATO_NORMATIVO + FONTE_AGU + SUMULA
 * 4. Para cada resultado:
 *    a. isAtoNormativoGeral()? → 'concreto' = pular
 *    b. Deduplicar (Document.douUrl + LegislativeAct.fullNumber)
 *    c. shouldAutoApprove()?
 *       → SIM: criar Document + LegislativeAct
 *       → NÃO: criar DOUStagingDocument
 * 5. Detectar alterações (detectModifications)
 * 6. Retornar stats
 *
 * Configuração: vercel.json → "0 8 * * *" (8h UTC = 5h BR)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchLastWeek } from '@/lib/dou-api';
import { DOUClassifier, DOUDocumentCategory } from '@/lib/dou-classifier';
import { isAtoNormativoGeral, shouldAutoApprove, detectAtoType } from '@/lib/dou-normative-filter';
import { detectModifications } from '@/lib/dou-change-detector';
import { LeiIndexer } from '@/lib/lei-indexer';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Termos de busca focados em atos normativos
const SEARCH_TERMS = [
  'lei 14.133 OR lei 14133 OR nova lei de licitações',
  'decreto licitação OR decreto contratação',
  'instrução normativa SEGES OR instrução normativa MGI',
  'portaria normativa licitação OR portaria normativa contratação',
];

// Categorias relevantes do DOUClassifier
const RELEVANT_CATEGORIES = new Set<string>([
  DOUDocumentCategory.ATO_NORMATIVO,
  DOUDocumentCategory.FONTE_AGU,
  DOUDocumentCategory.SUMULA,
]);

// Mapeamento de categorias DOU → Document.category
const CATEGORY_MAP: Record<string, string> = {
  [DOUDocumentCategory.ATO_NORMATIVO]: 'legislacao',
  [DOUDocumentCategory.FONTE_AGU]: 'parecer',
  [DOUDocumentCategory.SUMULA]: 'sumula',
};

// Mapeamento de tipo → hierarchyLevel para LegislativeAct
const HIERARCHY_MAP: Record<string, number> = {
  lei: 1, mp: 1, decreto: 2, portaria: 3, in: 4, on: 5,
};

// Mapeamento de changeType → LeiArticleNote.type
const CHANGE_TYPE_MAP: Record<string, string> = {
  altera: 'alteracao',
  revoga: 'revogacao',
  regulamenta: 'regulamentacao',
  complementa: 'comentario',
};

export async function GET(request: NextRequest) {
  console.log('[Sync DOU Normativos] Iniciando sincronização...');

  try {
    // 1. Auth
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const limitParam = searchParams.get('limit');
    const maxResults = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : 100;

    const stats = {
      totalBuscados: 0,
      filtradosPorClassificador: 0,
      filtradosPorConcreto: 0,
      duplicados: 0,
      autoAprovados: 0,
      enviadosParaStaging: 0,
      alteracoesDetectadas: 0,
      notasLeiCriadas: 0,
      erros: 0,
      detalhes: [] as string[],
    };

    // 2. Buscar DOU com múltiplos termos
    const allResults = new Map<string, typeof results[0]>();
    let results: Awaited<ReturnType<typeof searchLastWeek>> = [];

    for (const term of SEARCH_TERMS) {
      try {
        const termResults = await searchLastWeek(term, undefined, maxResults);
        for (const r of termResults) {
          if (!allResults.has(r.href)) {
            allResults.set(r.href, r);
          }
        }
      } catch (error) {
        console.error(`[Sync DOU Normativos] Erro ao buscar "${term}":`, error);
        stats.erros++;
      }
      // Rate limiting entre buscas
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    results = Array.from(allResults.values());
    stats.totalBuscados = results.length;
    console.log(`[Sync DOU Normativos] ${results.length} resultados únicos encontrados`);

    if (results.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum resultado encontrado', stats, dryRun });
    }

    // 3. Classificar com DOUClassifier
    const classifications = DOUClassifier.classifyBatch(results);

    // 4. Processar cada resultado
    for (const [result, classification] of classifications.entries()) {
      try {
        // 4a. Filtrar por categoria relevante
        if (!RELEVANT_CATEGORIES.has(classification.category)) {
          stats.filtradosPorClassificador++;
          continue;
        }

        const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();

        // 4b. Filtro de ato normativo geral vs concreto
        const normativeType = isAtoNormativoGeral(cleanTitle, result.abstract);
        if (normativeType === 'concreto') {
          stats.filtradosPorConcreto++;
          continue;
        }

        // 4c. Deduplicar
        const existingDoc = await prisma.document.findFirst({
          where: { douUrl: result.href },
        });
        if (existingDoc) {
          stats.duplicados++;
          continue;
        }

        const existingStaging = await prisma.dOUStagingDocument.findFirst({
          where: { url: result.href },
        });
        if (existingStaging) {
          stats.duplicados++;
          continue;
        }

        // 4d. Detectar tipo de ato
        const atoType = detectAtoType(cleanTitle);

        // 4e. Verificar se deve auto-aprovar
        const autoApprove = normativeType === 'geral' &&
          shouldAutoApprove(cleanTitle, result.hierarchyStr, atoType);

        // Parse da data
        let parsedDate: Date | undefined;
        try {
          const [day, month, year] = result.date.split('/').map(Number);
          parsedDate = new Date(year, month - 1, day);
        } catch {
          parsedDate = undefined;
        }

        if (dryRun) {
          stats.detalhes.push(
            `${autoApprove ? '[AUTO]' : '[STAGING]'} ${cleanTitle.substring(0, 80)}... (tipo: ${atoType || 'n/a'}, class: ${normativeType})`
          );
          if (autoApprove) stats.autoAprovados++;
          else stats.enviadosParaStaging++;
        } else if (autoApprove) {
          // --- AUTO-APROVAR: criar Document + LegislativeAct ---
          await prisma.$transaction(async (tx) => {
            const documentCategory = CATEGORY_MAP[classification.category] || 'legislacao';

            const newDoc = await tx.document.create({
              data: {
                title: cleanTitle,
                description: result.abstract || '',
                type: 'link',
                url: result.href,
                category: documentCategory,
                isPublic: true,
                tags: JSON.stringify(['ato_normativo', atoType || 'outro'].filter(Boolean)),
                content: result.abstract || '',
                douUrl: result.href,
                douData: parsedDate,
                douSecao: result.section,
                reviewed: true,
                reviewedAt: new Date(),
                reviewedBy: 'auto-sync-dou',
                embeddingStatus: 'pending',
              },
            });

            // Criar LegislativeAct se tiver tipo detectável
            if (atoType) {
              const fullNumberMatch = cleanTitle.match(
                /(?:decreto|portaria|instrução\s+normativa|in|lei|medida\s+provisória)\s+(?:[\w/]+\s+)?n[ºo°]?\s*([\d.]+(?:\/\d{4})?)/i
              );
              const number = fullNumberMatch ? fullNumberMatch[1] : '';
              const yearMatch = cleanTitle.match(/(\d{4})/);
              const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

              const fullNumber = `${atoType === 'in' ? 'IN' : atoType === 'on' ? 'ON' : atoType === 'mp' ? 'MP' : atoType.charAt(0).toUpperCase() + atoType.slice(1)} ${number}/${year}`;

              // Verificar se LegislativeAct já existe
              const existingAct = await tx.legislativeAct.findUnique({
                where: { fullNumber },
              });

              if (!existingAct && number) {
                const issuer = extractIssuer(result.hierarchyStr);

                await tx.legislativeAct.create({
                  data: {
                    type: atoType,
                    number,
                    year,
                    fullNumber,
                    title: cleanTitle,
                    ementa: result.abstract || cleanTitle,
                    issuer,
                    publishDate: parsedDate || new Date(),
                    hierarchyLevel: HIERARCHY_MAP[atoType] || 5,
                    officialUrl: result.href,
                    createdBy: 'auto-sync-dou',
                  },
                });
              }
            }

            // Enriquecer com LeiIndexer (artigos da Lei 14.133 relacionados)
            try {
              const analysis = await LeiIndexer.analyzeDocument({
                id: newDoc.id,
                title: cleanTitle,
                category: documentCategory,
                tags: JSON.stringify([atoType]),
                content: result.abstract || '',
                description: result.abstract || '',
              });

              if (analysis.articles.length > 0) {
                const articleNumbers = LeiIndexer.resultToLeiArticles(analysis);
                await tx.document.update({
                  where: { id: newDoc.id },
                  data: { leiArticles: JSON.stringify(articleNumbers) },
                });
              }
            } catch (error) {
              console.error(`[Sync DOU Normativos] Erro LeiIndexer para ${newDoc.id}:`, error);
            }
          });

          stats.autoAprovados++;
        } else {
          // --- STAGING: enviar para aprovação manual ---
          await prisma.dOUStagingDocument.create({
            data: {
              douId: result.href,
              title: cleanTitle,
              abstract: result.abstract || '',
              url: result.href,
              section: result.section || 'do1',
              publishDate: result.date || new Date().toLocaleDateString('pt-BR'),
              hierarchyStr: result.hierarchyStr,
              category: classification.category,
              approvalStatus: normativeType === 'ambiguo' ? 'pending' : classification.status,
              confidence: classification.confidence,
              reasoning: JSON.stringify(classification.reasoning),
              isRelevant: true,
              requiresReview: true,
              imported: false,
            },
          });

          stats.enviadosParaStaging++;
        }

        // 5. Detectar alterações em legislação existente
        const modification = detectModifications(cleanTitle, result.abstract);
        if (modification) {
          stats.alteracoesDetectadas++;

          if (!dryRun) {
            // 5a. Se modifica Lei 14.133 com artigos específicos → criar LeiArticleNote
            if (modification.modifiesLei14133 && modification.affectedArticles.length > 0) {
              for (const artNumber of modification.affectedArticles) {
                try {
                  await prisma.leiArticleNote.create({
                    data: {
                      articleNumber: artNumber,
                      type: CHANGE_TYPE_MAP[modification.changeType] || 'comentario',
                      title: `${modification.changeType === 'altera' ? 'Alterado' : modification.changeType === 'revoga' ? 'Revogado' : 'Regulamentado'} por: ${cleanTitle.substring(0, 100)}`,
                      description: result.abstract || null,
                      detectedBy: 'auto-sync-dou',
                      isPublic: false,
                      adminReviewed: false,
                    },
                  });
                  stats.notasLeiCriadas++;
                } catch (error) {
                  console.error(`[Sync DOU Normativos] Erro ao criar LeiArticleNote para art. ${artNumber}:`, error);
                }
              }
            }

            // 5b. Se modifica ato existente → buscar e sinalizar
            if (modification.modifiesExistingAct && modification.existingActRef) {
              const ref = modification.existingActRef;
              try {
                // Buscar LegislativeAct com número similar
                const existingActs = await prisma.legislativeAct.findMany({
                  where: {
                    type: ref.type,
                    number: { contains: ref.number },
                    ...(ref.year ? { year: ref.year } : {}),
                  },
                  take: 5,
                });

                if (existingActs.length > 0) {
                  // Criar nota de alteração para cada ato encontrado
                  for (const act of existingActs) {
                    console.log(
                      `[Sync DOU Normativos] Alteração detectada: "${cleanTitle.substring(0, 60)}" → ${act.fullNumber}`
                    );
                  }
                }
              } catch (error) {
                console.error('[Sync DOU Normativos] Erro ao buscar ato existente:', error);
              }
            }
          } else {
            stats.detalhes.push(
              `[ALTERACAO] ${modification.changeType}: ${modification.modifiesLei14133 ? `Lei 14.133 arts: ${modification.affectedArticles.join(', ')}` : ''} ${modification.existingActRef ? `${modification.existingActRef.type} ${modification.existingActRef.number}` : ''}`
            );
          }
        }

        // Rate limiting entre processamento de documentos
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        stats.erros++;
        console.error('[Sync DOU Normativos] Erro ao processar documento:', error);
      }
    }

    // 6. Sincronizar staging: marcar imported=true onde URL já existe como Document
    if (!dryRun) {
      try {
        const pendingStaging = await prisma.dOUStagingDocument.findMany({
          where: { imported: false },
          select: { id: true, url: true },
        });

        for (const staging of pendingStaging) {
          const docExists = await prisma.document.findFirst({
            where: { douUrl: staging.url },
            select: { id: true },
          });
          if (docExists) {
            await prisma.dOUStagingDocument.update({
              where: { id: staging.id },
              data: { imported: true, importedAt: new Date(), documentId: docExists.id },
            });
          }
        }
      } catch (error) {
        console.error('[Sync DOU Normativos] Erro ao sincronizar staging:', error);
      }
    }

    console.log('[Sync DOU Normativos] Sincronização concluída:', stats);

    return NextResponse.json({
      success: true,
      dryRun,
      message: `Processados: ${stats.autoAprovados} auto-aprovados, ${stats.enviadosParaStaging} para staging, ${stats.alteracoesDetectadas} alterações detectadas`,
      stats,
    });

  } catch (error) {
    console.error('[Sync DOU Normativos] Erro fatal:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * Extrai o órgão emissor da hierarquia DOU
 */
function extractIssuer(hierarchyStr: string): string {
  const h = hierarchyStr.toLowerCase();
  if (h.includes('presidência') || h.includes('presidente')) return 'Presidência';
  if (h.includes('mgi') || h.includes('gestão e inovação')) return 'MGI';
  if (h.includes('seges') || h.includes('gestão e inovação')) return 'SEGES';
  if (h.includes('agu') || h.includes('advocacia')) return 'AGU';
  if (h.includes('tcu') || h.includes('tribunal de contas')) return 'TCU';
  if (h.includes('cgu') || h.includes('controladoria')) return 'CGU';
  if (h.includes('fazenda')) return 'Fazenda';
  return 'Outro';
}
