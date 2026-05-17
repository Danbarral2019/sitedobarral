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

export const EDITORIAL_PROMPT_VERSION = 'v1';

export interface EditorialCandidate {
  title: string;
  abstract: string;
  hierarchyStr: string;
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

Sua função: classificar se cada publicação do DOU é relevante pra um portal editorial sobre contratações públicas.

CRITÉRIO: o ato exige ALGUMA ação de quem gerencia contratos administrativos federais (gestor, fiscal, pregoeiro, advogado público de contratações)?

INCLUI:
- Lei 14.133 e regulamentação direta (decretos, portarias, IN, ON)
- Atos sobre licitação, contrato, ata de registro de preços, dispensa, convênio,
  fornecedor, pesquisa de preços, planejamento de contratações
- Atos de direito administrativo amplo que IMPACTAM contratos vigentes
  (jornada de servidores, teletrabalho, reorganização de unidades gestoras,
  novas atribuições de órgãos centrais como CGU/AGU/SEGES/MGI sobre contratações)

EXCLUI:
- Atos finalísticos de órgãos setoriais (IBAMA ambiental, ANATEL telecom, ANS saúde)
- Reorganização ministerial sem efeito contratual
- Normas individuais (nomeações, exonerações, designações pontuais)
- Atos de outros poderes não vinculantes ao executivo federal

EXEMPLOS:

[POSITIVO score 90] Decreto 12.926/2026 — Reduz jornada de servidores federais
em comissão. Afeta contratos vigentes que dependem de gestão por servidores
em comissão; vai exigir aditivos.
affects: ["contratos vigentes", "gestão de pessoas"]

[POSITIVO score 95] IN SEGES nº 8/2026 — Atualiza procedimentos de pesquisa
de preços. Aplicação direta da Lei 14.133, art. 23.
affects: ["Lei 14.133", "PCA", "contratos novos"]

[NEGATIVO score 10] IN IBAMA nº 5/2026 — Procedimentos de licenciamento
ambiental. Atividade-fim do órgão setorial.

[NEGATIVO score 20] Decreto 12.900/2026 — Cria Comitê Interministerial X.
Reorganização administrativa sem efeito direto em contratos.

[AMBÍGUO score 60] Lei 14.500 reestrutura carreira de procuradores federais.
Impacto indireto em quem atua na consultoria de contratos.
ambiguous: true

INSTRUÇÕES:
- Para cada item recebido, retorne JSON conforme o schema (use o campo "items")
- Mesma ordem de entrada na saída
- Seja honesto: se em dúvida, marque ambiguous=true e dê score 50-70
- Não invente "affects" — só liste áreas justificáveis pelo título/abstract
- Score < 50 só pra coisas claramente fora do escopo
- actType deve ser o tipo do ato; use "null" (string literal) se não for nenhum dos listados`;

function buildUserPrompt(candidates: EditorialCandidate[]): string {
  const items = candidates
    .map(
      (c, i) => `--- ITEM ${i + 1} ---
Título: ${c.title}
Órgão: ${c.hierarchyStr || 'n/d'}
Abstract: ${c.abstract || 'n/d'}`,
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
