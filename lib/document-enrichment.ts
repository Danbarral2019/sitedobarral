/**
 * Enriquecimento genérico de documentos do portal (qualquer categoria).
 *
 * Diferente de `lib/tcu-enrichment.ts` (TCU-only): aqui o prompt se adapta
 * à categoria do documento, sem depender de `metaTcu` ou outros campos
 * específicos de acórdãos TCU.
 *
 * Parâmetros alinhados com `ROADMAP_GEMINI_PAGO.md` (janelas amplas) e
 * `ROADMAP_GEMINI_MODELO_25.md` (gemini-2.5-flash + thinkingBudget 0).
 */

import { safeParseArray } from './utils';
import { parseLeiArticles, getLeiArticles } from './lei-articles';
import { PRIMARY_GEMINI_MODEL } from './gemini/config';

export const ENRICHMENT_DELAY_MS = 50;
export const CONTENT_MAX = 32_000;

export const SUMMARY_GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 1024,
  thinkingConfig: { thinkingBudget: 0 },
} as const;

export interface DocumentForSummary {
  title: string;
  description: string | null;
  content: string | null;
  category: string | null;
  tags: string | null;
  leiArticles: string | null;
  issuerOrg?: string | null;
  themes?: string | null;
  entityType?: string | null;
  enunciadoNumber?: string | null;
  onNumber?: number | null;
  onYear?: number | null;
}

/**
 * Mapeia category (slug técnico) para um rótulo legível que será usado
 * no prompt — isto é o que o modelo enxerga como "tipo de documento".
 */
function labelForCategory(category: string | null | undefined, doc: DocumentForSummary): string {
  const issuer = doc.issuerOrg ? ` do ${doc.issuerOrg}` : '';
  switch (category) {
    case 'orientacao-normativa':
      return `Orientação Normativa (AGU)${doc.onNumber && doc.onYear ? ` nº ${doc.onNumber}/${doc.onYear}` : ''}`;
    case 'orientacao_procedimento':
      return 'Orientação de Procedimento';
    case 'parecer-vinculante':
      return 'Parecer Vinculante (AGU)';
    case 'parecer':
      return 'Parecer jurídico';
    case 'decor':
      return 'Manifestação DECOR (AGU)';
    case 'lei-artigo':
      return 'Artigo da Lei 14.133/2021';
    case 'enunciados':
      return `Enunciado${doc.entityType ? ` ${doc.entityType}` : ''}${doc.enunciadoNumber ? ` nº ${doc.enunciadoNumber}` : ''}`;
    case 'sumula':
      return `Súmula${issuer}`;
    case 'informativo':
      return 'Informativo de Jurisprudência';
    case 'manual-tcu':
      return 'Manual do TCU';
    case 'consulta_tcu':
      return 'Consulta respondida pelo TCU';
    case 'ato-normativo':
      return 'Ato normativo';
    case 'boa_pratica':
      return `Boa prática${issuer}`;
    case 'acordao':
      return 'Acórdão TCU'; // fallback — idealmente usar lib/tcu-enrichment.ts
    case 'bibliografia':
      return 'Referência bibliográfica';
    default:
      return 'Documento';
  }
}

export function buildGenericSummaryPrompt(doc: DocumentForSummary): string {
  const categoryLabel = labelForCategory(doc.category, doc);

  const artigos = getLeiArticles(doc);
  const artigosStr = artigos.length > 0
    ? `Artigos da Lei 14.133/2021 vinculados: ${artigos.map(a => `Art. ${a}`).join(', ')}`
    : 'Sem artigo da Lei 14.133 vinculado especificamente (se aplicável, sugira na explicação).';

  const tags = safeParseArray(doc.tags);
  const tagsStr = tags.length > 0 ? tags.slice(0, 15).join(', ') : '';

  const themes = safeParseArray(doc.themes);
  const themesStr = themes.length > 0 ? themes.slice(0, 10).join(', ') : '';

  const hasContent = !!doc.content && doc.content.length > 200 && doc.content !== doc.description;
  const contentSection = hasContent
    ? `Conteúdo integral (trecho):\n${doc.content!.slice(0, CONTENT_MAX)}`
    : '';

  return `Você é um especialista em Direito Administrativo, Licitações e Contratos.

TAREFA: Gerar um resumo executivo de 3-5 frases para o documento abaixo.

CATEGORIA: ${categoryLabel}

REGRAS:
1. Linguagem acessível, para servidores públicos e operadores de licitações (não juristas).
2. Conectar claramente com a prática de licitações e contratos públicos, quando cabível.
3. Se houver artigos da Lei 14.133/2021 vinculados, cite-os; se não houver mas o tema tem correspondência clara com artigos da lei, mencione como "(relacionado ao art. X)".
4. Entre 3 e 5 frases, densas: priorize o "o que é" + "quando se aplica" + "implicação prática".
5. NÃO repita o título/número do documento no resumo.
6. Voz ativa, sem jargão desnecessário.
7. Para artigos da Lei 14.133: explique o que o artigo dispõe e uma situação prática típica.
8. Para pareceres / enunciados / súmulas: comece pela tese/orientação, depois contexto.
9. Para atos normativos / ONs / INs: explique o que regulamentam e a quem se aplica.
10. Retorne APENAS o resumo, sem preâmbulos ou títulos.

DADOS DO DOCUMENTO:
- Título: ${doc.title}
- ${artigosStr}${tagsStr ? `\n- Tags: ${tagsStr}` : ''}${themesStr ? `\n- Temas: ${themesStr}` : ''}

Descrição / ementa:
${doc.description || '(sem descrição)'}

${contentSection}

RESUMO EXECUTIVO:`;
}

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: SUMMARY_GENERATION_CONFIG,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  throw new Error('Resposta do Gemini sem texto');
}

// ===== LegislativeAct (tabela separada) =====

export interface LegislativeActForSummary {
  type: string;            // "decreto" | "portaria" | "in" | ...
  number: string;
  year: number;
  title: string;
  ementa: string;
  content: string | null;
  issuer: string;
  leiArticles: string | null;
  themes: string | null;
}

function legislativeActTypeLabel(type: string): string {
  const map: Record<string, string> = {
    'lei': 'Lei',
    'medida-provisoria': 'Medida Provisória',
    'decreto': 'Decreto',
    'portaria': 'Portaria',
    'in': 'Instrução Normativa',
    'instrucao-normativa': 'Instrução Normativa',
    'ordem-servico': 'Ordem de Serviço',
    'resolucao': 'Resolução',
  };
  return map[type] ?? 'Ato normativo';
}

export function buildLegislativeActPrompt(act: LegislativeActForSummary): string {
  const typeLabel = legislativeActTypeLabel(act.type);
  const fullNumber = `${typeLabel} nº ${act.number}/${act.year}`;

  const artigos = getLeiArticles(act);
  const artigosStr = artigos.length > 0
    ? `Artigos da Lei 14.133/2021 regulamentados/relacionados: ${artigos.map(a => `Art. ${a}`).join(', ')}`
    : 'Sem artigo específico da Lei 14.133 vinculado.';

  const themes = safeParseArray(act.themes);
  const themesStr = themes.length > 0 ? themes.slice(0, 10).join(', ') : '';

  const hasContent = !!act.content && act.content.length > 200;
  const contentSection = hasContent
    ? `Conteúdo integral (trecho):\n${act.content!.slice(0, CONTENT_MAX)}`
    : '';

  return `Você é um especialista em Direito Administrativo, Licitações e Contratos.

TAREFA: Gerar um resumo executivo de 3-5 frases para o ato normativo abaixo.

ATO: ${fullNumber}
EMISSOR: ${act.issuer}

REGRAS:
1. Linguagem acessível para servidores públicos e operadores de licitações.
2. Explique o que o ato regulamenta, a quem se aplica e qual a implicação prática em licitações/contratos.
3. Se regulamenta artigos da Lei 14.133/2021, cite-os.
4. Entre 3 e 5 frases. Densas, sem enrolação.
5. NÃO repita "${fullNumber}" no corpo do resumo.
6. Voz ativa. Sem jargão desnecessário.
7. Retorne APENAS o resumo.

DADOS:
- Título: ${act.title}
- ${artigosStr}${themesStr ? `\n- Temas: ${themesStr}` : ''}

Ementa oficial:
${act.ementa}

${contentSection}

RESUMO EXECUTIVO:`;
}
