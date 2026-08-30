/**
 * Persistência dos espelhos do STJ em `TribunalDecision`.
 *
 * Mesmo núcleo para o backfill do acervo e para o cron mensal, de modo que a
 * base não cresça descatalogada.
 */

import { prisma } from '@/lib/prisma';
import {
  classifyDecision,
  generateDecisionSummary,
  type ClassificationResult,
} from '@/lib/tribunal-scrapers/classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { normalizeTribunalCode } from '@/lib/tribunal-scrapers/utils';
import { SOURCE_API_STJ, TRIBUNAL_NAME_STJ } from './constantes';
import type { StjDecisaoNormalizada } from './types';

export interface OpcoesPersistenciaStj {
  dryRun?: boolean;
  forcar?: boolean;
  /** Resumo IA custa Gemini por julgado. Default true; o backfill desliga. */
  gerarResumo?: boolean;
  /**
   * Descarta o julgado que o classificador deixa em `pending`, gravando só
   * veredito definido. Default true — decisão do Daniel em 18/08: medido
   * sobre 614 espelhos reais, o acervo inteiro despejaria ~680 pendentes numa
   * fila de revisão que já tem 211 do STF parados. A zona cinzenta é
   * recuperável depois; os dumps continuam publicados.
   */
  descartarPendentes?: boolean;
}

export interface ResultadoPersistenciaStj {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagensErro: string[];
}

/**
 * Se o STJ diz, no campo estruturado de referências legislativas, que o
 * acórdão cita artigo da Lei 14.133, ele é relevante para um site sobre a Lei
 * 14.133 — independentemente do escore de palavra-chave. A referência é fato;
 * o escore é aproximação. Mesma regra já adotada no conector do STF.
 *
 * `relevanceScore`, `themes`, `confidence` e `suggestedCourses` continuam
 * sendo medidas do classificador e não são alteradas.
 */
export function aplicarAmarracaoAutoritativa(
  d: StjDecisaoNormalizada,
  classification: ClassificationResult
): ClassificationResult {
  if (d.artigos14133.length === 0) return classification;

  return {
    ...classification,
    approvalStatus: 'auto_approved',
    reasoning: `${classification.reasoning}; auto-aprovado: amarração autoritativa à Lei 14.133 (art. ${d.artigos14133.join(', ')}) via referências legislativas do STJ`,
  };
}

export function montarDadosStj(
  d: StjDecisaoNormalizada,
  classification: ClassificationResult,
  summary: string | null
) {
  return {
    tribunalCode: normalizeTribunalCode('stj'),
    tribunalName: TRIBUNAL_NAME_STJ,
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

    // Amarração vem SÓ do campo estruturado do STJ. A heurística de texto do
    // classificador captaria "art. 37 da Constituição" como artigo da 14.133.
    ...setLeiArticles(d.artigos14133),

    suggestedCourses: classification.suggestedCourses,
    sourceApi: SOURCE_API_STJ,
    sourceId: d.sourceId,
    sourceRawData: JSON.stringify({
      classe: d.classe,
      tema: d.tema,
      tese: d.tese,
      // Insumo da amarração à Lei 14.133 — ver types.ts.
      referenciasLegislativas: d.referenciasLegislativas,
    }),
    approvalStatus: classification.approvalStatus,
    confidence: classification.confidence,
    classificationReasoning: classification.reasoning,
  };
}

/**
 * Preserva o que é editorial: veredito de humano (`reviewedBy` não nulo) não é
 * recalculado, e resumo IA existente não é apagado por rodada que não gerou um.
 */
function montarDadosUpdateStj(
  data: ReturnType<typeof montarDadosStj>,
  existente: { reviewedBy: string | null }
): Partial<ReturnType<typeof montarDadosStj>> {
  const { approvalStatus, isRelevant, summary, ...resto } = data;
  const dadosUpdate: Partial<ReturnType<typeof montarDadosStj>> = { ...resto };

  if (!existente.reviewedBy) {
    dadosUpdate.approvalStatus = approvalStatus;
    dadosUpdate.isRelevant = isRelevant;
  }
  if (summary !== null) {
    dadosUpdate.summary = summary;
  }

  return dadosUpdate;
}

export async function persistirDecisoesStj(
  decisoes: StjDecisaoNormalizada[],
  opcoes: OpcoesPersistenciaStj
): Promise<ResultadoPersistenciaStj> {
  const gerarResumo = opcoes.gerarResumo !== false;
  const descartarPendentes = opcoes.descartarPendentes !== false;
  const r: ResultadoPersistenciaStj = {
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

      // `classifyDecision` não chama LLM (useAI é false por default), então
      // classificar em dry-run não custa nada — e é o que torna o dry-run
      // confiável: sem isso, ele conta como "criado" julgado que a rodada
      // real descartaria por `descartarPendentes`, superestimando o total.
      const classification = aplicarAmarracaoAutoritativa(
        d,
        await classifyDecision({
          title: d.title,
          ementa: d.ementa,
          decisionType: d.decisionType,
          tribunalCode: 'STJ',
        })
      );

      // Zona cinzenta não entra: ver `descartarPendentes`.
      if (descartarPendentes && classification.approvalStatus === 'pending') {
        r.ignorados++;
        continue;
      }

      if (opcoes.dryRun) {
        if (existente) r.atualizados++;
        else r.criados++;
        continue;
      }

      const summary =
        gerarResumo && classification.approvalStatus === 'auto_approved'
          ? await generateDecisionSummary({
              title: d.title,
              ementa: d.ementa,
              decisionType: d.decisionType,
              tribunalCode: 'STJ',
            })
          : null;

      const data = montarDadosStj(d, classification, summary);

      if (existente) {
        await prisma.tribunalDecision.update({
          where: { fullIdentifier: d.fullIdentifier },
          data: montarDadosUpdateStj(data, existente),
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
