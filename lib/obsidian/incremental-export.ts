/**
 * Incremental Export — DB → Obsidian Vault
 *
 * Queries DB for records changed since last export, regenerates only
 * the affected files plus all articles (backlinks) + static files.
 *
 * When no DB records changed, only static files are regenerated
 * (enunciados, temas, MOC — very fast).
 *
 * When --full is used, all ~4900 files are regenerated.
 */

import { join } from 'path';

import { CATEGORIA_GRAFO } from '@/lib/tcu/backfill-retroativo';
import { WHERE_ELEGIVEL_BASE, evidenciaIntegral } from '@/lib/tcu/elegibilidade-tese';

import {
  type DbDocument,
  type DbLegislativeAct,
  type DbTribunalDecision,
  type FileEntry,
  EXPORT_DOC_SELECT,
  EXPORT_ACT_SELECT,
  EXPORT_DECISION_SELECT,
  EXPORT_DECISION_WHERE,
  buildLinkGraph,
  generateAllFiles,
  generateArticleMd,
  generateDocumentMd,
  generateActMd,
  generateDecisionMd,
  generateEnunciadoMd,
  generateTemaMd,
  generateMOC,
  articleSlug,
  documentSlug,
  actSlug,
  decisionSlug,
  assignSlugs,
  enunciadoSlug,
  temaSlug,
  writeVault,
  removerObsoletos,
  LEI_14133_ARTIGOS,
  ENUNCIADOS,
  TEMAS_LICITACOES,
} from './export';
import { caminhoTese, gerarTeseMd } from './tese-md';

import { readSyncState, writeSyncState } from './sync-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportResult {
  filesWritten: number;
  documents: number;
  acts: number;
  decisions: number;
  teses: number;
  filesRemoved: number;
  mode: 'full' | 'incremental';
  durationMs: number;
}

export interface IncrementalExportOptions {
  projectRoot: string;
  outputDir: string;
  dryRun: boolean;
  full: boolean;
  /**
   * Inclui os ~13 mil acordaos que servem de combustivel ao grafo de
   * precedentes do TCU (`category: 'acordao-grafo'`).
   *
   * Default `false`, que e o certo para o COFRE DO OBSIDIAN: sao notas sem
   * curadoria, e afogariam as anotacoes do professor.
   *
   * O ELIC liga (`true`) porque o destino la e um indice de RAG, nao um cofre
   * para navegar. RAG busca, nao le sequencialmente -- o argumento de
   * "dossie ilegivel" nao transfere, e sao ~5 mil acordaos do TCU com sumario
   * real que nao existem em nenhum outro lugar do acervo.
   *
   * Isto NAO afrouxa a invisibilidade nas outras superficies: nas duas rotas
   * de busca a exclusao da categoria e o unico controle de acesso (elas nao
   * filtram isPublic), e la ela permanece. Ver
   * lib/tcu/invisibilidade-combustivel.test.ts.
   */
  incluirCombustivelDoGrafo?: boolean;

  /**
   * Inclui as teses destiladas do TCU (subdiretório `teses/`).
   *
   * Default `false`: o cofre do Obsidian do professor não as recebe. O ELIC
   * liga, porque lá o destino é índice de RAG.
   */
  incluirTeses?: boolean;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function runIncrementalExport(
  opts: IncrementalExportOptions,
): Promise<ExportResult> {
  const startTime = Date.now();

  const { PrismaClient } = await import('@prisma/client');
  const { PrismaNeon } = await import('@prisma/adapter-neon');

  // Load env if not already loaded
  if (!process.env.DATABASE_URL) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: join(opts.projectRoot, '.env.local') });
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

  try {
    // Capture timestamp BEFORE queries to avoid missing concurrent changes
    const exportTimestamp = new Date().toISOString();

    // Read sync state
    const state = await readSyncState(opts.projectRoot, opts.outputDir);
    const lastExportAt = state.lastExportAt;

    // -----------------------------------------------------------------------
    // Fetch ALL data (needed for link graph regardless of mode)
    // -----------------------------------------------------------------------
    // Exclui a categoria 'acordao-grafo' (combustivel do backfill retroativo
    // do grafo de precedentes do TCU) POR DESTINO, nao globalmente: o cofre
    // do Obsidian nao pode virar dossie de 10 mil acordaos sem curadoria,
    // mas o indice de RAG do ELIC se beneficia deles. Ver a opcao.
    const allDocuments: DbDocument[] = await prisma.document.findMany({
      where: opts.incluirCombustivelDoGrafo ? {} : { category: { not: CATEGORIA_GRAFO } },
      select: EXPORT_DOC_SELECT,
    });

    const allActs: DbLegislativeAct[] = await prisma.legislativeAct.findMany({
      select: EXPORT_ACT_SELECT,
    });

    const allDecisions: DbTribunalDecision[] = await prisma.tribunalDecision.findMany({
      where: EXPORT_DECISION_WHERE,
      select: EXPORT_DECISION_SELECT,
    });

    console.log(`  Documentos: ${allDocuments.length}`);
    console.log(`  Atos Normativos: ${allActs.length}`);
    console.log(`  Jurisprudencia: ${allDecisions.length}`);

    // -----------------------------------------------------------------------
    // Decide mode
    // -----------------------------------------------------------------------
    let files: FileEntry[];

    if (opts.full || !lastExportAt) {
      // Full export
      console.log(opts.full ? '  Modo: full (flag --full)' : '  Modo: full (primeiro export)');
      files = generateAllFiles(allDocuments, allActs, allDecisions);
    } else {
      // Incremental: check what changed since last export
      const since = new Date(lastExportAt);

      // For acts and decisions, we need updatedAt — fetch separately
      const changedActIds = (await prisma.legislativeAct.findMany({
        where: { updatedAt: { gt: since } },
        select: { id: true },
      })).map(a => a.id);

      const changedDecisionIds = (await prisma.tribunalDecision.findMany({
        where: {
          updatedAt: { gt: since },
          ...EXPORT_DECISION_WHERE,
        },
        select: { id: true },
      })).map(d => d.id);

      // Also check for docs changed (using updatedAt from a separate query)
      const changedDocIds = (await prisma.document.findMany({
        where: { updatedAt: { gt: since } },
        select: { id: true },
      })).map(d => d.id);

      const totalChanged = changedDocIds.length + changedActIds.length + changedDecisionIds.length;

      console.log(`  Desde ultimo export: ${lastExportAt}`);
      console.log(`  Documentos alterados: ${changedDocIds.length}`);
      console.log(`  Atos alterados: ${changedActIds.length}`);
      console.log(`  Decisoes alteradas: ${changedDecisionIds.length}`);

      if (totalChanged === 0) {
        // No DB changes — only regenerate static files (enunciados, temas, MOC)
        console.log('  Modo: incremental (sem alteracoes DB — apenas estaticos)');
        files = generateStaticFiles(allDocuments, allActs, allDecisions);
      } else {
        // Some changes — regenerate changed items + all articles + static
        console.log(`  Modo: incremental (${totalChanged} registros alterados)`);

        const graph = buildLinkGraph(allDocuments, allActs, allDecisions);
        files = [];

        // Resolve slugs únicos antes dos wikilinks (artigos referenciam docs/decisões)
        const docSlugById = assignSlugs(allDocuments, documentSlug);
        const decSlugById = assignSlugs(allDecisions, decisionSlug);

        // All articles (backlinks may have changed)
        for (const [, art] of Object.entries(LEI_14133_ARTIGOS)) {
          files.push({
            path: join('Artigos', `${articleSlug(art)}.md`),
            content: generateArticleMd(art, graph),
          });
        }

        // Changed documents
        const changedDocSet = new Set(changedDocIds);
        for (const doc of allDocuments) {
          if (!changedDocSet.has(doc.id)) continue;
          const slug = docSlugById.get(doc.id);
          if (!slug) continue;
          files.push({
            path: join('Documentos', `${slug}.md`),
            content: generateDocumentMd(doc),
          });
        }

        // Changed acts
        const changedActSet = new Set(changedActIds);
        for (const act of allActs) {
          if (!changedActSet.has(act.id)) continue;
          files.push({
            path: join('Atos Normativos', `${actSlug(act)}.md`),
            content: generateActMd(act),
          });
        }

        // Changed decisions
        const changedDecSet = new Set(changedDecisionIds);
        for (const dec of allDecisions) {
          if (!changedDecSet.has(dec.id)) continue;
          const slug = decSlugById.get(dec.id);
          if (!slug) continue;
          files.push({
            path: join('Jurisprudência', `${slug}.md`),
            content: generateDecisionMd(dec),
          });
        }

        // Static files (enunciados, temas, MOC)
        files.push(...generateStaticFiles(allDocuments, allActs, allDecisions));
      }
    }

    // -----------------------------------------------------------------------
    // Teses do TCU (spec §8.2)
    //
    // O subdiretório `teses/` é regenerado POR INTEIRO a cada exportação, não
    // por delta. A regra por delta tem um furo: quando uma tese DEIXA de ser
    // elegível, ela some do conjunto consultado e nada marca o arquivo como
    // desatualizado — o arquivo fica com a tese que já não vale ao lado das
    // que valem. Detectar isso exigiria consultar as quatro formas de sair;
    // como são algumas dezenas de arquivos pequenos, regenerar é mais barato
    // e correto por construção.
    // -----------------------------------------------------------------------
    let totalTeses = 0;
    const caminhosDeTese = new Set<string>();
    if (opts.incluirTeses) {
      const destilacoes = await prisma.teseDestilacao.findMany({
        where: { atual: true, enunciados: { some: WHERE_ELEGIVEL_BASE } },
        select: {
          id: true, numeroAlvo: true, anoAlvo: true, colegiadoAlvo: true,
          relatorAlvo: true, acordaoKey: true, urlAlvo: true,
          origemIdentidade: true, citantesConcordantes: true,
          assunto: true, confianca: true, dossieNoVoto: true,
          enunciados: {
            where: WHERE_ELEGIVEL_BASE,
            select: {
              id: true, enunciado: true, inovacao: true, veredito: true,
              publicado: true, trechosFonte: true, atualizadoEm: true,
              trechos: {
                orderBy: { ordem: 'asc' },
                select: {
                  ordem: true, trecho: true, origemNumero: true, origemAno: true,
                  origemColegiado: true, origemUrl: true, origemLinkPDF: true,
                  origemDocumentId: true, noVoto: true,
                },
              },
            },
          },
        },
      });

      for (const d of destilacoes) {
        // A integralidade da evidência não cabe no filtro SQL (compara contagem
        // contra um campo Json), então é conferida aqui, enunciado a enunciado.
        const elegiveis = d.enunciados.filter(e => evidenciaIntegral(e));
        if (elegiveis.length === 0) continue;
        const atualizadoEm = elegiveis
          .map(e => e.atualizadoEm)
          .reduce((a, b) => (a > b ? a : b));
        const dados = { ...d, atualizadoEm, enunciados: elegiveis };
        const caminho = caminhoTese(dados);
        // Duas destilações `atual: true` com mesmo número, ano e colegiado
        // colidiriam no mesmo arquivo: a segunda sobrescreveria a primeira em
        // `writeVault`, e contar as duas mentiria no total do README. Isso
        // não é esperado — só acontece se duas versões ficaram `atual` para
        // o mesmo alvo, uma inconsistência de dado — por isso é aviso, não
        // silêncio: alguém precisa investigar qual das duas é a válida.
        if (caminhosDeTese.has(caminho)) {
          console.warn(
            `  [AVISO] Duas destilações atuais geram o mesmo arquivo ${caminho}: ` +
              `${d.id} colide com uma anterior. Pulando ${d.id}.`,
          );
          continue;
        }
        caminhosDeTese.add(caminho);
        files.push({ path: caminho, content: gerarTeseMd(dados) });
        totalTeses++;
      }
    }

    // -----------------------------------------------------------------------
    // Write files
    // -----------------------------------------------------------------------
    let removidos: string[] = [];
    if (opts.dryRun) {
      console.log(`  [DRY RUN] ${files.length} arquivos seriam escritos`);
      if (opts.incluirTeses) {
        removidos = await removerObsoletos(opts.outputDir, 'teses', caminhosDeTese, true);
        console.log(`  [DRY RUN] ${removidos.length} arquivos obsoletos seriam removidos de teses/`);
        for (const nome of removidos) {
          console.log(`  [DRY RUN]   - teses/${nome}`);
        }
      }
    } else {
      await writeVault(opts.outputDir, files);
      if (opts.incluirTeses) {
        removidos = await removerObsoletos(opts.outputDir, 'teses', caminhosDeTese, false);
      }
    }

    // Update sync state
    if (!opts.dryRun) {
      await writeSyncState(opts.projectRoot, opts.outputDir, {
        lastExportAt: exportTimestamp,
        exportStats: {
          documents: allDocuments.length,
          acts: allActs.length,
          decisions: allDecisions.length,
        },
      });
    }

    return {
      filesWritten: files.length,
      documents: allDocuments.length,
      acts: allActs.length,
      decisions: allDecisions.length,
      teses: totalTeses,
      filesRemoved: removidos.length,
      mode: (opts.full || !lastExportAt) ? 'full' : 'incremental',
      durationMs: Date.now() - startTime,
    };
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Static files (enunciados + temas + MOC)
// ---------------------------------------------------------------------------

function generateStaticFiles(
  documents: DbDocument[],
  acts: DbLegislativeAct[],
  decisions: DbTribunalDecision[],
): FileEntry[] {
  // Garante o registro de slugs únicos populado para os wikilinks de temas/MOC
  assignSlugs(documents, documentSlug);
  assignSlugs(decisions, decisionSlug);

  const files: FileEntry[] = [];

  for (const en of ENUNCIADOS) {
    files.push({
      path: join('Enunciados', `${enunciadoSlug(en)}.md`),
      content: generateEnunciadoMd(en),
    });
  }

  for (const tema of TEMAS_LICITACOES) {
    files.push({
      path: join('Temas', `${temaSlug(tema.value, tema.label)}.md`),
      content: generateTemaMd(tema, documents, acts, decisions),
    });
  }

  files.push({
    path: 'MOC.md',
    content: generateMOC(documents, acts, decisions),
  });

  return files;
}
