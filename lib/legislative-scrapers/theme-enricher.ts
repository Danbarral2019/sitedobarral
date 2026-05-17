/**
 * Classificação de atos normativos em temas canônicos.
 *
 * Duas estratégias (em ordem de custo crescente):
 *   1. Heurística: leiArticles → tema via mapping; keyword matching em title+ementa
 *   2. AI (Claude Haiku): para atos onde a heurística não retornou nenhum tema
 *
 * Funções puras (heurística) + função async (AI). Consumidas tanto pelos
 * scripts one-off (scripts/enrich-*.ts) quanto pelo cron semanal
 * (app/api/cron/enrich-themes/route.ts).
 */

import { generate } from '@/lib/ai';
import { parseLeiArticles } from '@/lib/lei-articles';
import { CANONICAL_THEMES, validateThemes } from './theme-validator';

/**
 * Mapping de artigos da Lei 14.133/2021 → temas canônicos.
 */
const TEMAS_LICITACOES: ReadonlyArray<{ value: string; articles: readonly string[] }> = [
  { value: 'principios-gerais', articles: ['1', '2', '3', '4', '5'] },
  { value: 'agentes-governanca', articles: ['7', '8', '9', '10', '11', '12', '13'] },
  { value: 'planejamento', articles: ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28'] },
  { value: 'pesquisa-precos', articles: ['23'] },
  { value: 'modalidades', articles: ['28', '29', '30', '31', '32', '33'] },
  { value: 'pregao-eletronico', articles: ['17', '28', '29'] },
  { value: 'contratacao-direta', articles: ['72', '73', '74', '75', '76'] },
  { value: 'registro-precos', articles: ['82', '83', '84', '85', '86'] },
  {
    value: 'contratos',
    articles: ['89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110'],
  },
  { value: 'gestao-fiscalizacao', articles: ['115', '116', '117', '118', '119', '120', '121'] },
  { value: 'sancoes', articles: ['155', '156', '157', '158', '159', '160', '161', '162'] },
  { value: 'sustentabilidade', articles: ['11', '144', '145', '146'] },
  { value: 'tecnologia-informacao', articles: ['6'] },
  { value: 'obras-engenharia', articles: ['46', '47', '48', '49'] },
  { value: 'controle-transparencia', articles: ['169', '170', '171', '172', '173'] },
];

const THEME_KEYWORDS: Record<string, string[]> = {
  'principios-gerais': ['principio', 'disposicao', 'regra geral'],
  'agentes-governanca': ['agente', 'governanca', 'pregoeiro', 'comissao'],
  'planejamento': ['planejamento', 'estudo preliminar', 'ETP', 'termo de referencia'],
  'pesquisa-precos': ['pesquisa de preco', 'preco estimado', 'orcamento estimado'],
  'modalidades': ['modalidade', 'concorrencia', 'dialogo competitivo'],
  'pregao-eletronico': ['pregao', 'eletronico', 'lance'],
  'contratacao-direta': ['dispensa', 'inexigibilidade', 'contratacao direta'],
  'registro-precos': ['registro de preco', 'SRP', 'ata de registro'],
  'contratos': ['contrato administrativo', 'clausula', 'garantia contratual'],
  'gestao-fiscalizacao': ['fiscal', 'fiscalizacao', 'gestao contratual', 'medicao'],
  'sancoes': ['sancao', 'penalidade', 'multa', 'impedimento', 'inidoneidade'],
  'sustentabilidade': ['sustentabilidade', 'desenvolvimento nacional', 'ambiental'],
  'tecnologia-informacao': ['tecnologia da informacao', 'TIC', 'software', 'solucao de TI'],
  'obras-engenharia': ['obra', 'engenharia', 'servico de engenharia', 'BDI'],
  'controle-transparencia': ['controle', 'transparencia', 'portal', 'PNCP'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Input da classificação. Aceita os campos mínimos de LegislativeAct.
 */
export interface ActForClassification {
  fullNumber: string;
  title: string | null;
  ementa: string | null;
  leiArticles: string | null; // JSON array de strings
  content?: string | null;
}

/**
 * Classificação por heurística: mapping de artigos + keyword matching.
 * Pura, sem I/O. Deduplica preservando ordem de inserção.
 */
export function classifyByHeuristic(act: ActForClassification): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (theme: string) => {
    if (!seen.has(theme)) {
      seen.add(theme);
      out.push(theme);
    }
  };

  // 1. Artigos
  {
    const articles = parseLeiArticles(act.leiArticles);
    for (const art of articles) {
      for (const tema of TEMAS_LICITACOES) {
        if (tema.articles.includes(art)) add(tema.value);
      }
    }
  }

  // 2. Keywords em title + ementa
  const text = normalizeText([act.title ?? '', act.ementa ?? ''].join(' '));
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (seen.has(theme)) continue;
    for (const kw of keywords) {
      if (text.includes(normalizeText(kw))) {
        add(theme);
        break;
      }
    }
  }

  return out;
}

const AI_SYSTEM_PROMPT = `Você é classificador de atos normativos sobre licitações e contratos públicos (Lei 14.133/2021). Sua tarefa: atribuir temas de uma taxonomia FIXA.`;

function buildAiPrompt(act: ActForClassification): string {
  const contentHead = act.content ? act.content.slice(0, 2000) : null;
  return `Classifique o ato abaixo usando APENAS valores da taxonomia fixa:

TAXONOMIA FIXA (use somente estes strings exatos):
${CANONICAL_THEMES.map((t) => `- ${t}`).join('\n')}

ATO: ${act.fullNumber}
EMENTA: ${act.ementa ?? '(sem ementa)'}

TRECHO DO CONTEÚDO:
${contentHead ?? '(sem conteúdo)'}

Regras:
- Retorne JSON no formato: {"themes": ["tema1", "tema2"]}
- Máximo 4 temas
- Se nenhum tema da taxonomia encaixar bem, retorne {"themes": []}
- NÃO invente novos valores; use exatamente os strings listados acima

Responda APENAS com o JSON, sem explicação.`;
}

export interface AiClassificationResult {
  ok: boolean;
  themes: string[];
  reason?: string;
  tokens?: { input?: number; output?: number };
}

/**
 * Classificação via LLM (Claude Haiku 4.5 via lib/ai task 'classification').
 * Valida resposta contra taxonomia canônica antes de retornar. Nunca lança —
 * retorna `{ ok: false, reason }` em caso de erro ou resposta inválida.
 */
export async function classifyByAi(act: ActForClassification): Promise<AiClassificationResult> {
  let responseText: string;
  let tokens: { input?: number; output?: number } = {};
  try {
    const resp = await generate('classification', {
      systemPrompt: AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAiPrompt(act) }],
      temperature: 0.1,
      maxTokens: 200,
      jsonMode: true,
    });
    responseText = resp.text;
    tokens = { input: resp.inputTokens, output: resp.outputTokens };
  } catch (err) {
    return {
      ok: false,
      themes: [],
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  // Claude às vezes envelopa JSON em code fences apesar de jsonMode: true.
  const stripped = responseText
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return {
      ok: false,
      themes: [],
      reason: `non-JSON response: ${responseText.slice(0, 120)}`,
      tokens,
    };
  }

  const validation = validateThemes(parsed);
  if (!validation.ok) {
    return { ok: false, themes: [], reason: validation.reason, tokens };
  }

  return { ok: true, themes: validation.themes!, tokens };
}
