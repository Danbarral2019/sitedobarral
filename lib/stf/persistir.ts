/**
 * Persistência das decisões do STF em `TribunalDecision`.
 *
 * Compartilhado entre o backfill por script (Fase 1) e a rota de ingestão
 * alimentada pelo runner (Fase 2) — um único núcleo para o passivo e para o
 * fluxo novo, de modo que a base não cresça descatalogada.
 */

import { prisma } from '@/lib/prisma';
import {
  classifyDecision,
  generateDecisionSummary,
  type ClassificationResult,
} from '@/lib/tribunal-scrapers/classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { normalizeTribunalCode } from '@/lib/tribunal-scrapers/utils';
import type { StfDecisaoNormalizada } from './types';

export const SOURCE_API_STF = 'stf-jurisprudencia-api';
export const TRIBUNAL_NAME_STF = 'Supremo Tribunal Federal';

export interface OpcoesPersistencia {
  dryRun?: boolean;
  forcar?: boolean;
}

export interface ResultadoPersistenciaStf {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagensErro: string[];
}

/**
 * Amarração à norma (`artigos14133`) é fato, não heurística: vem do campo
 * estruturado `documental_legislacao_citada_texto` da própria API do STF —
 * se o STF diz que o acórdão cita art. da Lei 14.133, ele é relevante para
 * um site sobre a Lei 14.133, independentemente do escore de palavra-chave
 * do classificador. Por isso um julgado com amarração é aprovado
 * automaticamente, sobrepondo o veredito do classificador.
 *
 * Aplicada logo após `classifyDecision` (antes da decisão de gerar resumo
 * IA e de `montarDadosStf`), para que resumo e approvalStatus fiquem
 * consistentes — ver `persistirDecisoesStf`.
 *
 * `relevanceScore`, `themes`, `confidence` e `suggestedCourses` são medidas
 * do classificador e não são alteradas por esta sobreposição.
 */
export function aplicarAmarracaoAutoritativa(
  d: StfDecisaoNormalizada,
  classification: ClassificationResult
): ClassificationResult {
  if (d.artigos14133.length === 0) {
    return classification;
  }

  return {
    ...classification,
    approvalStatus: 'auto_approved',
    reasoning: `${classification.reasoning}; auto-aprovado: amarração autoritativa à Lei 14.133 (art. ${d.artigos14133.join(', ')}) via legislação citada do STF`,
  };
}

export function montarDadosStf(
  d: StfDecisaoNormalizada,
  classification: ClassificationResult,
  summary: string | null
) {
  return {
    tribunalCode: normalizeTribunalCode('stf'),
    tribunalName: TRIBUNAL_NAME_STF,
    decisionType: d.decisionType,
    decisionNumber: d.decisionNumber,
    processNumber: d.processNumber,
    year: d.year,
    fullIdentifier: d.fullIdentifier,
    title: d.title,
    ementa: d.ementa,
    summary,
    relator: d.relator,
    orgaoJulgador: d.orgaoJulgador,
    dataJulgamento: d.dataJulgamento,
    dataPublicacao: d.dataPublicacao,
    url: d.url,
    isRelevant: classification.approvalStatus !== 'auto_rejected',
    relevanceScore: classification.relevanceScore,
    themes: JSON.stringify(classification.themes),

    // Amarração à norma vem SÓ do campo estruturado do STF
    // (documental_legislacao_citada_texto). A heurística de texto do
    // classificador captaria "art. 37 da Constituição" como artigo da 14.133 —
    // é a classe de erro que já custou caro no motor do TCU.
    ...setLeiArticles(d.artigos14133),

    suggestedCourses: classification.suggestedCourses,
    sourceApi: SOURCE_API_STF,
    sourceId: d.sourceId,
    sourceRawData: JSON.stringify({
      classe: d.classe,
      uf: d.uf,
      repercussaoGeral: d.repercussaoGeral,
      tema: d.tema,
      tese: d.tese,
      indexacao: d.indexacao,
      ementaTruncada: d.ementaTruncada,
    }),
    approvalStatus: classification.approvalStatus,
    confidence: classification.confidence,
    classificationReasoning: classification.reasoning,
  };
}

/**
 * Monta o payload de `update` a partir de `montarDadosStf`, preservando o
 * que já é editorial: se um humano revisou a decisão (`reviewedBy` não
 * nulo), o veredito dele (`approvalStatus`/`isRelevant`) não é recalculado
 * por cima; e um resumo IA já existente nunca é apagado por um re-run cuja
 * classificação desta rodada não gerou resumo novo (`summary === null`).
 * O restante do conteúdo (ementa, datas, leiArticlesArr, themes etc.)
 * sempre é atualizado normalmente.
 */
function montarDadosUpdateStf(
  data: ReturnType<typeof montarDadosStf>,
  existente: { reviewedBy: string | null }
): Partial<ReturnType<typeof montarDadosStf>> {
  const { approvalStatus, isRelevant, summary, ...resto } = data;
  const dadosUpdate: Partial<ReturnType<typeof montarDadosStf>> = { ...resto };

  if (!existente.reviewedBy) {
    dadosUpdate.approvalStatus = approvalStatus;
    dadosUpdate.isRelevant = isRelevant;
  }

  if (summary !== null) {
    dadosUpdate.summary = summary;
  }

  return dadosUpdate;
}

export async function persistirDecisoesStf(
  decisoes: StfDecisaoNormalizada[],
  opcoes: OpcoesPersistencia
): Promise<ResultadoPersistenciaStf> {
  const r: ResultadoPersistenciaStf = {
    criados: 0,
    atualizados: 0,
    ignorados: 0,
    erros: 0,
    mensagensErro: [],
  };

  for (const d of decisoes) {
    try {
      const existente = await prisma.tribunalDecision.findUnique({
        where: { fullIdentifier: d.fullIdentifier },
        select: { id: true, reviewedBy: true, summary: true },
      });

      if (existente && !opcoes.forcar) {
        r.ignorados++;
        continue;
      }

      // Em dry-run, a contagem depende só de `existente` — não há necessidade
      // de classificar nem de gerar resumo (que custam Gemini) para um
      // resultado que será jogado fora.
      if (opcoes.dryRun) {
        if (existente) r.atualizados++;
        else r.criados++;
        continue;
      }

      const classification = aplicarAmarracaoAutoritativa(
        d,
        await classifyDecision({
          title: d.title,
          ementa: d.ementa,
          decisionType: d.decisionType,
          tribunalCode: 'STF',
        })
      );

      const summary =
        classification.approvalStatus === 'auto_approved'
          ? await generateDecisionSummary({
              title: d.title,
              ementa: d.ementa,
              decisionType: d.decisionType,
              tribunalCode: 'STF',
            })
          : null;

      const data = montarDadosStf(d, classification, summary);

      if (existente) {
        await prisma.tribunalDecision.update({
          where: { fullIdentifier: d.fullIdentifier },
          data: montarDadosUpdateStf(data, existente),
        });
        r.atualizados++;
      } else {
        await prisma.tribunalDecision.create({ data });
        r.criados++;
      }
    } catch (error) {
      r.erros++;
      r.mensagensErro.push(
        `${d.fullIdentifier}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return r;
}
