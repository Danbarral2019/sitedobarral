/**
 * Orquestrador de enriquecimento para o DocumentWizard.
 *
 * Combina:
 * - LeiIndexer (Gemini Flash) para sugestão de `leiArticles` — lê content,
 *   tem regras especiais (Art. 6, pareceres fora de licitação).
 * - Claude Sonnet via lib/ai para os 7 campos editoriais (summary, highlights,
 *   keyPoints, practicalUse, publicNotes, suggestedImportance, tags).
 *
 * Política de merge: LeiIndexer vence sempre em `leiArticles` (lê texto, tem
 * regras de domínio). Claude vira fallback de emergência apenas se LeiIndexer
 * falhar por erro de rede/API. Quando LeiIndexer retorna [] de forma legítima
 * (doc sem relação com a lei), respeita a decisão e devolve [].
 */

import { LeiIndexer, type ArticleAnalysisResult } from '@/lib/lei-indexer';
import { generate } from '@/lib/ai';
import type { Document } from '@prisma/client';

export interface WizardEnhanceInput {
  /** Presente em [id]/enhance; ausente em temp-enhance (doc ainda não existe). */
  id?: string;
  title: string;
  description?: string;
  category: string;
  url?: string;
  summary?: string;
  /** Trechos editoriais (Document.content). */
  content?: string;
  /** Texto extraído integral (Document.extractedText) — fonte preferida para LeiIndexer. */
  extractedText?: string;
  tags?: string[];
}

export type ImportanceLevel = 'baixa' | 'media' | 'alta' | 'critica';

export interface WizardEnhanceOutput {
  summary: string;
  highlights: string[];
  keyPoints: string[];
  practicalUse: string;
  publicNotes: string;
  suggestedImportance: ImportanceLevel;
  tags: string[];
  leiArticles: number[];
  confidence: number;
  reasoning: string;
  /** Diagnóstico interno (não exibido pela UI — útil para log/debug). */
  _meta: {
    leiIndexerSucceeded: boolean;
    claudeSucceeded: boolean;
    leiIndexerArticles: string[];
    claudeArticles: number[];
    mergeStrategy: 'lei-indexer' | 'lei-indexer-empty' | 'fallback-claude' | 'all-failed';
  };
}

interface ClaudeEditorialResult {
  summary: string;
  highlights: string[];
  keyPoints: string[];
  practicalUse: string;
  publicNotes: string;
  suggestedImportance: ImportanceLevel;
  tags: string[];
  leiArticles: number[]; // mantido só para fallback quando LeiIndexer falha
  confidence: number;
  reasoning: string;
}

const VALID_IMPORTANCE: ImportanceLevel[] = ['baixa', 'media', 'alta', 'critica'];

function buildClaudeEditorialPrompt(input: WizardEnhanceInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const ctx = [
    `TÍTULO: ${input.title}`,
    `CATEGORIA: ${input.category}`,
    input.description ? `DESCRIÇÃO:\n${input.description}` : '',
    input.summary ? `RESUMO EXISTENTE:\n${input.summary}` : '',
    input.extractedText
      ? `TEXTO INTEGRAL (truncado):\n${input.extractedText.slice(0, 16000)}`
      : input.content
        ? `CONTEÚDO:\n${input.content.slice(0, 16000)}`
        : '',
    input.url ? `URL: ${input.url}` : '',
  ].filter(Boolean).join('\n\n');

  const systemPrompt = 'Você é um assistente especializado em Direito Administrativo e Licitações, ajudando o Prof. Daniel Barral a catalogar documentos para seus cursos sobre a Lei 14.133/2021.';

  const userPrompt = `Analise o documento abaixo e gere um enriquecimento editorial em formato JSON.

${ctx}

Retorne APENAS um JSON (sem markdown, sem explicações) com esta estrutura EXATA:

{
  "summary": "Resumo executivo do documento em 2-3 parágrafos, destacando o que é e por que é relevante",
  "highlights": ["Destaque 1", "Destaque 2", "Destaque 3"],
  "keyPoints": ["Ponto-chave 1 (direto, conciso)", "Ponto-chave 2", "Ponto-chave 3"],
  "practicalUse": "Como o aluno pode aplicar este documento na prática profissional (2-3 frases)",
  "publicNotes": "Observação educacional do professor para os alunos, destacando aspectos importantes para estudo (2-3 frases, tom didático)",
  "suggestedImportance": "baixa|media|alta|critica",
  "tags": ["tag1", "tag2", "tag3"],
  "leiArticles": [],
  "confidence": 85,
  "reasoning": "Explicação sobre o nível de importância sugerido"
}

IMPORTANTE:
- "leiArticles": SEMPRE retorne array vazio []. Outro sistema (LeiIndexer) cuida desta sugestão — você foca apenas nos campos editoriais.
- "suggestedImportance":
  * "critica" = documento fundamental, leitura obrigatória
  * "alta" = muito relevante, leitura recomendada
  * "media" = relevante para casos específicos
  * "baixa" = complementar, leitura opcional
- "confidence": 0-100, baseado na qualidade/quantidade de informações disponíveis
- "publicNotes": Escreva como se fosse o Prof. Barral orientando alunos ("Este documento é essencial para...", "Atenção especial para...", etc)

Retorne SOMENTE o JSON, sem formatação markdown.`;

  return { systemPrompt, userPrompt };
}

async function callClaudeEditorial(input: WizardEnhanceInput): Promise<ClaudeEditorialResult> {
  const { systemPrompt, userPrompt } = buildClaudeEditorialPrompt(input);

  const { text } = await generate('enhancement', {
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.3,
    maxTokens: 2048,
  });

  let json = text.trim();
  if (json.startsWith('```json')) {
    json = json.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (json.startsWith('```')) {
    json = json.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(json) as ClaudeEditorialResult;

  if (!parsed.summary || !parsed.suggestedImportance) {
    throw new Error('Resposta da IA editorial incompleta');
  }

  if (!VALID_IMPORTANCE.includes(parsed.suggestedImportance)) {
    parsed.suggestedImportance = 'media';
  }

  // Defesas mínimas — o prompt pede [] mas se vier algo, normaliza
  parsed.leiArticles = Array.isArray(parsed.leiArticles)
    ? parsed.leiArticles.map((a) => parseInt(String(a), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= 194)
    : [];
  parsed.tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  parsed.highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
  parsed.keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
  parsed.confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(100, parsed.confidence))
    : 50;
  parsed.reasoning = parsed.reasoning || '';
  parsed.practicalUse = parsed.practicalUse || '';
  parsed.publicNotes = parsed.publicNotes || '';

  return parsed;
}

/**
 * Converte número de artigo do LeiIndexer (string como "5", "184-A") em
 * inteiro para o contrato existente do wizard (`AIEnhancementResult.leiArticles: number[]`).
 * Artigos com letra (ex: 184-A) viram 184 — a UI não distingue hoje.
 */
export function leiIndexerToNumbers(articles: string[]): number[] {
  return articles
    .map((s) => parseInt(s.replace(/[^0-9]/g, ''), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 194);
}

export function mergeEnhancementResults(
  leiResult: PromiseSettledResult<ArticleAnalysisResult>,
  claudeResult: PromiseSettledResult<ClaudeEditorialResult>
): WizardEnhanceOutput {
  const leiOk = leiResult.status === 'fulfilled';
  const claudeOk = claudeResult.status === 'fulfilled';

  const leiArticlesRaw = leiOk ? LeiIndexer.resultToLeiArticles(leiResult.value) : [];
  const leiArticlesNum = leiIndexerToNumbers(leiArticlesRaw);
  const claudeArticles = claudeOk ? claudeResult.value.leiArticles : [];

  // Editorial = sempre Claude (fonte única). Sem Claude, retorna vazios.
  const editorial: ClaudeEditorialResult = claudeOk
    ? claudeResult.value
    : {
        summary: '',
        highlights: [],
        keyPoints: [],
        practicalUse: '',
        publicNotes: '',
        suggestedImportance: 'media',
        tags: [],
        leiArticles: [],
        confidence: 0,
        reasoning: claudeResult.status === 'rejected'
          ? `Falha na geração editorial: ${String((claudeResult as PromiseRejectedResult).reason)}`
          : '',
      };

  let leiArticles: number[];
  let confidence: number;
  let reasoning: string;
  let strategy: WizardEnhanceOutput['_meta']['mergeStrategy'];

  if (leiOk && leiArticlesNum.length > 0) {
    strategy = 'lei-indexer';
    leiArticles = leiArticlesNum;
    confidence = leiResult.value.confidence;
    reasoning = leiResult.value.reasoning || editorial.reasoning;
  } else if (leiOk) {
    // Gemini rodou OK mas devolveu [] — doc sem relação com a lei
    strategy = 'lei-indexer-empty';
    leiArticles = [];
    confidence = leiResult.value.confidence ?? 0;
    reasoning = leiResult.value.reasoning || 'Documento sem relação direta com a Lei 14.133';
  } else if (claudeOk && claudeArticles.length > 0) {
    // LeiIndexer falhou — fallback de emergência usando o que Claude inferiu
    strategy = 'fallback-claude';
    leiArticles = claudeArticles;
    confidence = editorial.confidence;
    reasoning = `${editorial.reasoning} [fallback: LeiIndexer indisponível]`;
  } else {
    strategy = 'all-failed';
    leiArticles = [];
    confidence = 0;
    reasoning = 'Falha completa na análise IA';
  }

  return {
    summary: editorial.summary,
    highlights: editorial.highlights,
    keyPoints: editorial.keyPoints,
    practicalUse: editorial.practicalUse,
    publicNotes: editorial.publicNotes,
    suggestedImportance: editorial.suggestedImportance,
    tags: editorial.tags,
    leiArticles,
    confidence,
    reasoning,
    _meta: {
      leiIndexerSucceeded: leiOk,
      claudeSucceeded: claudeOk,
      leiIndexerArticles: leiArticlesRaw,
      claudeArticles,
      mergeStrategy: strategy,
    },
  };
}

/**
 * Constrói o input que LeiIndexer.analyzeDocument espera (Pick<Document>).
 */
function buildLeiInput(input: WizardEnhanceInput): Pick<Document, 'id' | 'title' | 'category' | 'tags' | 'content' | 'description'> {
  return {
    id: input.id ?? 'temp',
    title: input.title,
    category: input.category,
    tags: input.tags ? JSON.stringify(input.tags) : null,
    description: input.description ?? null,
    // Preferimos extractedText (texto integral) sobre content (trechos editoriais)
    content: input.extractedText ?? input.content ?? null,
  };
}

export async function wizardEnhance(input: WizardEnhanceInput): Promise<WizardEnhanceOutput> {
  const leiDoc = buildLeiInput(input);

  // Threshold por categoria — espelha lógica interna do LeiIndexer (parecer = 60),
  // mas explícito aqui para visibilidade.
  const isParecer = ['parecer-vinculante', 'decor', 'parecer'].includes(input.category);
  const minConfidence = isParecer ? 60 : 40;

  const [leiResult, claudeResult] = await Promise.allSettled([
    LeiIndexer.analyzeDocument(leiDoc, { minConfidence }),
    callClaudeEditorial(input),
  ]);

  return mergeEnhancementResults(leiResult, claudeResult);
}
