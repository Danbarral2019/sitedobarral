/**
 * LLM-as-judge para a QUALIDADE DA SÍNTESE do assistente jurídico (Fase 1,
 * passo 5). Mede o que o aluno de fato vê — a resposta gerada — contra o
 * material (contexto) fornecido ao modelo. O eval de retrieval (runner.ts) mede
 * só o ranking de documentos; este mede fidelidade e completude do texto.
 *
 * Dimensões (0..1):
 * - faithfulness: toda afirmação da resposta é sustentada pelo contexto? (sem alucinação)
 * - citationAccuracy: citações/aspas correspondem ao que o contexto realmente diz?
 * - completeness: a resposta usa as fontes RELEVANTES disponíveis no contexto?
 *
 * O juiz é um modelo forte (Claude Sonnet 5 por padrão) — deliberadamente
 * diferente do sintetizado, para não haver viés de auto-avaliação.
 */
import { generate } from '@/lib/ai';

export interface SynthesisVerdict {
  faithfulness: number;
  citationAccuracy: number;
  completeness: number;
  overall: number;
  issues: string[];
  rationale: string;
}

export interface JudgeParams {
  query: string;
  answer: string;
  /** Material fornecido ao assistente (o synthesisPrompt / contexto de fontes). */
  context: string;
  /** Modelo juiz (default: claude-sonnet-5). */
  model?: string;
}

const JUDGE_SYSTEM = `Você é um avaliador SÊNIOR e RIGOROSO de respostas jurídicas sobre licitações e contratos públicos (Lei 14.133/2021).
Sua tarefa é auditar a resposta de um assistente de IA APENAS contra o material (contexto) que lhe foi fornecido.
Seja crítico e conservador: na dúvida, penalize. O padrão é a resposta poder ser usada por um aluno em prova ou peça processual.
Você NÃO avalia se a resposta "soa bem" — avalia se é FIEL e COMPLETA frente ao contexto.`;

function buildPrompt(p: JudgeParams): string {
  return `Avalie a RESPOSTA do assistente contra o MATERIAL FORNECIDO abaixo.

MATERIAL FORNECIDO AO ASSISTENTE (única fonte de verdade admissível):
"""
${p.context}
"""

PERGUNTA DO ALUNO:
${p.query}

RESPOSTA DO ASSISTENTE (a ser avaliada):
"""
${p.answer}
"""

Pontue de 0.0 a 1.0 (uma casa decimal) cada dimensão:
- faithfulness: 1.0 = toda afirmação é sustentada pelo material; 0.0 = inventa conteúdo/atribui às fontes coisas que elas não dizem. Trechos entre aspas que NÃO aparecem literalmente no material derrubam a nota.
- citationAccuracy: 1.0 = todas as citações (números de artigo, súmula, acórdão, enunciado) existem no material e são atribuídas corretamente; penalize citações inventadas ou trocadas.
- completeness: 1.0 = usa as fontes RELEVANTES presentes no material e cobre os pontos-chave da pergunta; penalize omissão de fontes claramente pertinentes que estavam no material.

Liste em "issues" os problemas concretos (alucinações, citações erradas, omissões). Em "rationale", 1-3 frases justificando.

Responda SOMENTE com um objeto JSON válido, sem texto ao redor, no formato:
{"faithfulness":0.0,"citationAccuracy":0.0,"completeness":0.0,"issues":["..."],"rationale":"..."}`;
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Extrai e valida o veredito do texto do juiz (tolerante a cercas ```json). */
export function parseVerdict(text: string): SynthesisVerdict {
  let raw = text.trim();
  if (raw.includes('```json')) raw = raw.split('```json')[1].split('```')[0].trim();
  else if (raw.includes('```')) raw = raw.split('```')[1].split('```')[0].trim();
  else {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const faithfulness = clamp01(parsed.faithfulness);
  const citationAccuracy = clamp01(parsed.citationAccuracy);
  const completeness = clamp01(parsed.completeness);
  // Overall pondera fidelidade (peso 2) acima de completude — para um produto
  // jurídico, alucinar é pior do que ser incompleto.
  const overall = (faithfulness * 2 + citationAccuracy * 2 + completeness) / 5;

  return {
    faithfulness,
    citationAccuracy,
    completeness,
    overall: Math.round(overall * 1000) / 1000,
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
  };
}

/** Julga a qualidade de uma resposta sintetizada contra o contexto fornecido. */
export async function judgeSynthesis(params: JudgeParams): Promise<SynthesisVerdict> {
  const { text } = await generate('classification', {
    provider: 'anthropic',
    model: params.model ?? 'claude-sonnet-5',
    systemPrompt: JUDGE_SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(params) }],
    temperature: 0,
    maxTokens: 1024,
    jsonMode: true,
  });
  return parseVerdict(text);
}
