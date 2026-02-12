#!/usr/bin/env npx tsx
/**
 * Scan Histórico do DOU — Desde a Lei 14.133 (01/04/2021)
 *
 * Script one-shot que busca o DOU mês a mês desde abril/2021
 * para encontrar atos normativos relevantes que não estão no acervo.
 *
 * Uso:
 *   npx tsx scripts/scan-dou-historico.ts --dry-run
 *   npx tsx scripts/scan-dou-historico.ts --dry-run --limit 50
 *   npx tsx scripts/scan-dou-historico.ts --import --from 2021-04 --to 2026-02
 *   npx tsx scripts/scan-dou-historico.ts --import --from 2024-01 --limit 100
 *
 * Flags:
 *   --dry-run     Apenas relatório, sem importar
 *   --import      Importar gaps encontrados
 *   --from YYYY-MM  Mês inicial (padrão: 2021-04)
 *   --to YYYY-MM    Mês final (padrão: mês atual)
 *   --limit N       Limite de resultados por mês (padrão: 200)
 */

import { PrismaClient } from '@prisma/client';
import { DOUClient, DOUSection, DOUPeriod, DOUField } from '../lib/dou-api';
import { DOUClassifier, DOUDocumentCategory } from '../lib/dou-classifier';
import { isAtoNormativoGeral, detectAtoType, shouldAutoApprove } from '../lib/dou-normative-filter';
import { detectModifications } from '../lib/dou-change-detector';

const prisma = new PrismaClient();
const douClient = new DOUClient();

// --- Parse args ---
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const doImport = args.includes('--import');
const fromArg = args.find((_, i) => args[i - 1] === '--from') || '2021-04';
const toArg = args.find((_, i) => args[i - 1] === '--to') || getCurrentYearMonth();
const limitArg = args.find((_, i) => args[i - 1] === '--limit');
const maxResultsPerMonth = limitArg ? parseInt(limitArg, 10) : 200;

if (!dryRun && !doImport) {
  console.log('Uso: npx tsx scripts/scan-dou-historico.ts --dry-run|--import [--from YYYY-MM] [--to YYYY-MM] [--limit N]');
  process.exit(1);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

interface ScanResult {
  title: string;
  url: string;
  date: string;
  atoType: string | null;
  normativeClass: string;
  autoApprove: boolean;
  status: 'already_indexed' | 'gap' | 'alteration';
  modification?: ReturnType<typeof detectModifications>;
}

const SEARCH_TERMS = [
  'lei 14.133 OR lei 14133',
  'decreto licitação OR contratação pública',
  'instrução normativa SEGES OR instrução normativa MGI',
];

const RELEVANT_CATEGORIES = new Set<string>([
  DOUDocumentCategory.ATO_NORMATIVO,
  DOUDocumentCategory.FONTE_AGU,
  DOUDocumentCategory.SUMULA,
]);

async function scanMonth(yearMonth: string): Promise<ScanResult[]> {
  const [year, month] = yearMonth.split('-').map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0); // Último dia do mês

  const publishFrom = formatDateDDMMYYYY(from);
  const publishTo = formatDateDDMMYYYY(to);

  console.log(`\n--- Escaneando ${yearMonth} (${publishFrom} a ${publishTo}) ---`);

  const allResults = new Map<string, { title: string; abstract: string; href: string; date: string; hierarchyStr: string; section: string }>();

  for (const term of SEARCH_TERMS) {
    try {
      const results = await douClient.search({
        searchTerm: term,
        sections: [DOUSection.TODOS],
        period: DOUPeriod.PERSONALIZADO,
        publishFrom,
        publishTo,
        field: DOUField.TUDO,
        isExactSearch: false,
        maxResults: maxResultsPerMonth,
      });

      for (const r of results) {
        if (!allResults.has(r.href)) {
          allResults.set(r.href, {
            title: r.title.replace(/<[^>]*>/g, '').trim(),
            abstract: r.abstract || '',
            href: r.href,
            date: r.date,
            hierarchyStr: r.hierarchyStr || '',
            section: r.section || 'do1',
          });
        }
      }
    } catch (error) {
      console.error(`  Erro ao buscar "${term}":`, error instanceof Error ? error.message : error);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`  ${allResults.size} resultados únicos`);

  const scanResults: ScanResult[] = [];

  for (const [url, result] of allResults.entries()) {
    // Classificar
    const classification = DOUClassifier.classify(result.title, result.abstract);
    if (!RELEVANT_CATEGORIES.has(classification.category)) continue;

    // Filtro normativo
    const normativeClass = isAtoNormativoGeral(result.title, result.abstract);
    if (normativeClass === 'concreto') continue;

    const atoType = detectAtoType(result.title);
    const autoApprove = normativeClass === 'geral' && shouldAutoApprove(result.title, result.hierarchyStr, atoType);

    // Verificar se já existe (por douUrl, staging, OU título no LegislativeAct/Document)
    const existingDoc = await prisma.document.findFirst({
      where: {
        OR: [
          { douUrl: url },
          { title: { contains: result.title.substring(0, 80), mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    const existingStaging = await prisma.dOUStagingDocument.findFirst({
      where: { url },
      select: { id: true },
    });

    // Também verificar LegislativeAct por título/fullNumber
    const existingAct = await prisma.legislativeAct.findFirst({
      where: {
        OR: [
          { title: { contains: result.title.substring(0, 80), mode: 'insensitive' } },
          { fullNumber: { contains: result.title.substring(0, 40), mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    // Detectar alterações
    const modification = detectModifications(result.title, result.abstract);

    let status: ScanResult['status'] = 'gap';
    if (existingDoc || existingStaging || existingAct) status = 'already_indexed';
    if (modification) status = 'alteration';

    scanResults.push({
      title: result.title,
      url,
      date: result.date,
      atoType,
      normativeClass,
      autoApprove,
      status,
      modification: modification || undefined,
    });
  }

  return scanResults;
}

async function main() {
  console.log('=== Scan Histórico DOU ===');
  console.log(`Modo: ${dryRun ? 'DRY-RUN (apenas relatório)' : 'IMPORT (importar gaps)'}`);
  console.log(`Período: ${fromArg} a ${toArg}`);
  console.log(`Limite por mês: ${maxResultsPerMonth}`);
  console.log('');

  // Gerar lista de meses
  const months: string[] = [];
  const [fromY, fromM] = fromArg.split('-').map(Number);
  const [toY, toM] = toArg.split('-').map(Number);

  let curY = fromY, curM = fromM;
  while (curY < toY || (curY === toY && curM <= toM)) {
    months.push(`${curY}-${String(curM).padStart(2, '0')}`);
    curM++;
    if (curM > 12) { curM = 1; curY++; }
  }

  console.log(`Total de meses a escanear: ${months.length}`);

  const allScanResults: ScanResult[] = [];
  let totalGaps = 0;
  let totalAlreadyIndexed = 0;
  let totalAlterations = 0;
  let totalImported = 0;

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    console.log(`\nProgresso: ${i + 1}/${months.length} (${month})`);

    try {
      const results = await scanMonth(month);
      allScanResults.push(...results);

      for (const r of results) {
        if (r.status === 'already_indexed') totalAlreadyIndexed++;
        else if (r.status === 'alteration') totalAlterations++;
        else totalGaps++;
      }

      // Importar gaps se modo --import
      if (doImport) {
        const gaps = results.filter(r => r.status === 'gap');
        for (const gap of gaps) {
          try {
            let parsedDate: Date | undefined;
            try {
              const [day, m, year] = gap.date.split('/').map(Number);
              parsedDate = new Date(year, m - 1, day);
            } catch { /* ignore */ }

            if (gap.autoApprove) {
              await prisma.document.create({
                data: {
                  title: gap.title,
                  description: '',
                  type: 'link',
                  url: gap.url,
                  category: 'legislacao',
                  isPublic: true,
                  tags: JSON.stringify(['ato_normativo', gap.atoType || 'outro'].filter(Boolean)),
                  content: '',
                  douUrl: gap.url,
                  douData: parsedDate,
                  reviewed: true,
                  reviewedAt: new Date(),
                  reviewedBy: 'scan-historico-dou',
                  embeddingStatus: 'pending',
                },
              });
            } else {
              await prisma.dOUStagingDocument.create({
                data: {
                  douId: gap.url,
                  title: gap.title,
                  abstract: '',
                  url: gap.url,
                  section: 'do1',
                  publishDate: gap.date || '',
                  category: 'ato_normativo',
                  approvalStatus: 'pending',
                  confidence: 60,
                  reasoning: JSON.stringify(['Identificado pelo scan histórico']),
                  isRelevant: true,
                  requiresReview: true,
                  imported: false,
                },
              });
            }
            totalImported++;
          } catch (error) {
            // Pode ser duplicata
            if (error instanceof Error && error.message.includes('Unique constraint')) {
              continue;
            }
            console.error(`  Erro ao importar "${gap.title.substring(0, 50)}...":`, error instanceof Error ? error.message : error);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Salvar checkpoint (progresso)
      console.log(`  Resultados do mês: ${results.length} (${results.filter(r => r.status === 'gap').length} gaps)`);

    } catch (error) {
      console.error(`  ERRO no mês ${month}:`, error instanceof Error ? error.message : error);
    }

    // Rate limiting entre meses
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // --- Relatório Final ---
  console.log('\n\n========================================');
  console.log('       RELATORIO FINAL');
  console.log('========================================');
  console.log(`Período: ${fromArg} a ${toArg}`);
  console.log(`Total de resultados: ${allScanResults.length}`);
  console.log(`Ja indexados (OK): ${totalAlreadyIndexed}`);
  console.log(`Gaps (faltantes): ${totalGaps}`);
  console.log(`Alteracoes detectadas: ${totalAlterations}`);
  if (doImport) console.log(`Importados: ${totalImported}`);
  console.log('');

  // Detalhar gaps
  const gaps = allScanResults.filter(r => r.status === 'gap');
  if (gaps.length > 0) {
    console.log(`\n--- GAPS (${gaps.length} atos faltantes) ---`);
    for (const gap of gaps.slice(0, 50)) {
      console.log(`  ${gap.autoApprove ? '[AUTO]' : '[MANUAL]'} ${gap.date} | ${gap.atoType || 'n/a'} | ${gap.title.substring(0, 100)}`);
    }
    if (gaps.length > 50) console.log(`  ... e mais ${gaps.length - 50} gaps`);
  }

  // Detalhar alterações
  const alterations = allScanResults.filter(r => r.status === 'alteration');
  if (alterations.length > 0) {
    console.log(`\n--- ALTERACOES DETECTADAS (${alterations.length}) ---`);
    for (const alt of alterations.slice(0, 30)) {
      const mod = alt.modification;
      const detail = mod ? `${mod.changeType}${mod.modifiesLei14133 ? ` Lei 14.133 arts: ${mod.affectedArticles.join(',')}` : ''}${mod.existingActRef ? ` ${mod.existingActRef.type} ${mod.existingActRef.number}` : ''}` : '';
      console.log(`  ${alt.date} | ${detail} | ${alt.title.substring(0, 80)}`);
    }
  }

  console.log('\n========================================');
  console.log('Scan concluido!');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Erro fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
