/**
 * Classificador IA editorial pra DOU Clipping v2.
 *
 * Avalia se uma publicação do DOU exige ação de quem gerencia contratos
 * administrativos federais. Substitui o filtro keyword `isProcurementRelated`
 * por um julgamento semântico via Gemini structured output.
 *
 * Spec: docs/superpowers/specs/2026-05-03-dou-clipping-v2-design.md
 *
 * Provider/modelo resolvidos via `lib/ai` (task=classification + provider
 * forçado para Gemini). Combina as 3 features de #55: responseSchema,
 * systemPrompt (instrução de sistema), per-call model override.
 */

import { generate } from './ai';
import { PRIMARY_GEMINI_MODEL } from './gemini/config';

export const EDITORIAL_PROMPT_VERSION = 'v2';

/** Limite de caracteres do texto integral enviado por item. */
export const EDITORIAL_TEXT_MAX_CHARS = 3000;

export interface EditorialCandidate {
  title: string;
  abstract: string;
  hierarchyStr: string;
  /** Texto oficial do ato (`.texto-dou`). Sem ele, a IA julga só pelo trecho da busca. */
  fullText?: string | null;
}

export interface EditorialClassification {
  score: number;
  reason: string;
  summary: string;
  affects: string[];
  actType: 'decreto' | 'portaria' | 'in' | 'lei' | 'mp' | 'on' | null;
  ambiguous: boolean;
}

export interface EditorialBatchResult {
  classifications: EditorialClassification[];
  model: string;
  promptVersion: string;
}

// Schema JSON puro (literais 'OBJECT'/'ARRAY'/'NUMBER'/'STRING'/'BOOLEAN' —
// valores dos antigos `Type` enums da SDK @google/genai). lib/ai/providers/
// gemini.ts repassa este objeto em `generationConfig.responseSchema`.
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          score: { type: 'NUMBER' },
          reason: { type: 'STRING' },
          summary: { type: 'STRING' },
          affects: { type: 'ARRAY', items: { type: 'STRING' } },
          actType: {
            type: 'STRING',
            enum: ['decreto', 'portaria', 'in', 'lei', 'mp', 'on', 'null'],
          },
          ambiguous: { type: 'BOOLEAN' },
        },
        required: ['score', 'reason', 'summary', 'affects', 'actType', 'ambiguous'],
      },
    },
  },
  required: ['items'],
} as const;

const SYSTEM_PROMPT = `Você é um jurista especializado em Lei 14.133/2021 e contratos administrativos federais.

Sua função: dar nota a cada publicação do DOU para o acervo de um portal jurídico sobre licitações e contratos. O editor só aprova NORMA GERAL que regula a contratação pública. Tudo o que você pontuar com 50 ou mais vai para a fila de revisão humana; seja exigente.

NOTA ALTA (80-100):
- Lei 14.133/2021 e sua regulamentação (decretos, portarias e INs de alcance geral)
- Atos de órgãos centrais para toda a administração: SEGES/MGI, CGU, AGU, SECOM (contratações de comunicação), Receita Federal quando trata de retenção ou regularidade fiscal de fornecedores
- Leis e medidas provisórias que criam hipótese de contratação direta (dispensa ou inexigibilidade), mesmo quando o tema principal é outro

NOTA BAIXA (abaixo de 50), mesmo que o texto cite a Lei 14.133:
- Norma interna de um só órgão ou entidade sobre as próprias contratações (ministério, autarquia, universidade, conselho profissional). Exceção: norma técnica de contratação reaproveitável por outros órgãos, como contratação de nuvem ou software (nota 55-65, ambiguous=true)
- Pessoal: jornada, teletrabalho, carreiras, cargos, benefícios, gratificações, estrutura regimental
- Orçamento e finanças: créditos, limites de empenho, cronogramas de desembolso
- Tributação em geral, consultas tributárias, preços de combustíveis
- Parcerias com a sociedade civil (Lei 13.019), organizações sociais, transferências voluntárias, convênios e programas setoriais (PAC, PAA, habitação, saúde)
- Setor regulado: leilões de energia, concessões e permissões de serviço público específicas, decisões de agências reguladoras
- Qualquer ato concreto: sanção a uma empresa, resultado de licitação, aditivo, alienação de imóvel, reconhecimento de emergência, repasse a município

EXEMPLOS (julgados pelo editor):

[APROVADO score 95] Decreto 13.106/2026. Regulamenta o art. 79, IV, da Lei 14.133 (Sistema de Compras Expressas).
affects: ["Lei 14.133", "contratos novos"]

[APROVADO score 85] Lei 15.473/2026. Altera leis de fundos e autoriza a União a contratar agente financeiro sem licitação.
affects: ["contratação direta"]

[APROVADO score 85] IN RFB 2.335/2026. Modelos de declaração para a retenção de tributos nos pagamentos a fornecedores.
affects: ["pagamento de contratos"]

[REJEITADO score 30] Portaria GM/MS 12.157/2026. Monitoramento das contratações do Ministério da Saúde. Norma interna de um órgão.

[REJEITADO score 25] Portaria SNTEP/MME 3.197/2026. Sanções da Lei 14.133 em leilão de energia. Setor regulado.

[REJEITADO score 20] Lei 15.432/2026. Política de transporte público coletivo; a exigência de licitação da concessão é incidental.

[REJEITADO score 10] Decreto 13.049/2026. Indenização a servidores em localidades estratégicas. Pessoal.

INSTRUÇÕES:
- Julgue pelo TEXTO do ato quando ele vier; o resumo da busca é só um trecho e engana
- Para cada item recebido, retorne JSON conforme o schema (use o campo "items"), na mesma ordem de entrada
- summary descreve o que o ato de fato faz, em 1-2 frases, sem supor conteúdo ausente do texto
- Em dúvida real, marque ambiguous=true e dê score 50-65
- Não invente "affects": só liste áreas justificáveis pelo texto
- actType deve ser o tipo do ato; use "null" (string literal) se não for nenhum dos listados`;

function buildUserPrompt(candidates: EditorialCandidate[]): string {
  const items = candidates
    .map(
      (c, i) => `--- ITEM ${i + 1} ---
Título: ${c.title}
Órgão: ${c.hierarchyStr || 'n/d'}
Abstract: ${c.abstract || 'n/d'}${c.fullText ? `\nTexto: ${c.fullText.slice(0, EDITORIAL_TEXT_MAX_CHARS)}` : ''}`,
    )
    .join('\n\n');
  return `Classifique os ${candidates.length} item(ns) abaixo. Retorne items[] na mesma ordem.\n\n${items}`;
}

function normalizeActType(raw: string | null | undefined): EditorialClassification['actType'] {
  if (!raw || raw === 'null') return null;
  const valid: EditorialClassification['actType'][] = ['decreto', 'portaria', 'in', 'lei', 'mp', 'on'];
  return (valid as string[]).includes(raw) ? (raw as EditorialClassification['actType']) : null;
}

export async function classifyEditorialBatch(
  candidates: EditorialCandidate[],
  opts?: { model?: string },
): Promise<EditorialBatchResult> {
  const model = opts?.model || PRIMARY_GEMINI_MODEL;

  if (candidates.length === 0) {
    return {
      classifications: [],
      model,
      promptVersion: EDITORIAL_PROMPT_VERSION,
    };
  }

  const { text } = await generate('classification', {
    messages: [{ role: 'user', content: buildUserPrompt(candidates) }],
    provider: 'gemini',
    model,
    systemPrompt: SYSTEM_PROMPT,
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0,
    thinkingBudget: 0,
  });

  if (!text) throw new Error('Gemini retornou texto vazio');

  let parsed: { items?: Array<Partial<EditorialClassification> & { actType?: string }> };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Resposta IA não é JSON válido: ${(err as Error).message}`);
  }

  const items = parsed.items || [];
  if (items.length !== candidates.length) {
    throw new Error(
      `IA retornou ${items.length} items mas foram enviados ${candidates.length} candidatos`,
    );
  }

  const classifications: EditorialClassification[] = items.map((it) => ({
    score: Math.max(0, Math.min(100, Math.round(Number(it.score ?? 0)))),
    reason: String(it.reason || '').trim(),
    summary: String(it.summary || '').trim(),
    affects: Array.isArray(it.affects) ? it.affects.map(String).filter(Boolean) : [],
    actType: normalizeActType(it.actType),
    ambiguous: Boolean(it.ambiguous),
  }));

  return {
    classifications,
    model,
    promptVersion: EDITORIAL_PROMPT_VERSION,
  };
}
