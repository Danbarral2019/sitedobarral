/**
 * Tribunal Decision Classifier
 *
 * Classifica decisoes de tribunais por relevancia para licitacoes/contratos.
 * Usa keywords de shared-keywords.ts e opcionalmente Gemini IA para pendentes.
 */

import { KEYWORDS_RELEVANCIA, CURSOS_KEYWORDS, detectTemas } from '@/lib/shared-keywords';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { generate } from '@/lib/ai';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import { apiLogger } from "@/lib/logger";
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

// ===========================
// Types
// ===========================

export interface DecisionInput {
  title: string;
  ementa: string;
  fullText?: string | null;
  decisionType?: string;
  tribunalCode?: string;
}

export interface ClassificationResult {
  relevanceScore: number;
  approvalStatus: 'auto_approved' | 'pending' | 'auto_rejected';
  themes: string[];
  leiArticles: string[];
  reasoning: string;
  suggestedCourses: string;
  confidence: number;
}

// ===========================
// Lei article detection
// ===========================

/**
 * Números que a Lei 14.133 realmente tem — inclui os arts. 337-E a 337-P, os
 * crimes que ela inseriu no Código Penal e que o índice do projeto carrega.
 *
 * `LEI_14133_ARTIGOS` é importado estaticamente de propósito: o classifier só
 * roda server-side (crons, rotas admin e scripts de scraping), nunca em
 * componente de cliente, então o peso do índice não chega a bundle de browser.
 */
const ARTIGOS_DA_LEI = new Set(Object.keys(LEI_14133_ARTIGOS));

export function detectLeiArticles(text: string): string[] {
  const articles = new Set<string>();

  // Match: Art. 1, art. 12, artigo 130, Art. 1o, Art. 1., Arts. 1 e 2
  const patterns = [
    /\bart(?:igo|\.)\s*(\d{1,3}(?:-[A-Z])?)/gi,
    /\barts?\.\s*(\d{1,3}(?:-[A-Z])?)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = match[1].replace(/^0+/, '');
      // A regex casa QUALQUER "art. N" do texto, e o acórdão cita muitas leis —
      // sem saber de qual delas é o artigo. Medido em 30/08/2026: 114
      // amarrações do acervo apontavam para artigo inexistente na Lei 14.133,
      // 109 delas do TCE-PE (art. 966 do CPC, 884 do Código Civil, 132-D da Lei
      // Orgânica do TCE-PE). Exigir que o número exista na lei elimina tudo
      // isso sem heurística. Não resolve o "art. 5º do CPC", cujo número
      // também existe aqui — para esse caso não há sinal no texto.
      if (num && ARTIGOS_DA_LEI.has(num)) {
        // Número puro ("75"), sem prefixo — formato canônico do índice
        // LEI_14133_ARTIGOS e dos campos leiArticlesArr de Document/
        // LegislativeAct. Gravar "Art. 75" quebra o cruzamento decisão↔artigo.
        articles.add(num);
      }
    }
  }

  return Array.from(articles).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    return numA - numB;
  });
}

// ===========================
// Keyword-based scoring
// ===========================

// Paradigmatic keywords (consultas em tese, teses fixadas)
const PARADIGMATIC_KEYWORDS = {
  strong: ['consulta', 'fixar tese', 'tese fixada', 'entendimento', 'uniformização', 'súmula', 'enunciado', 'interpretação', 'precedente', 'consulta em tese'],
  moderate: ['divergência', 'revisão de entendimento', 'paradigma', 'recurso de revisão', 'prejudicial de mérito'],
  indicators: ['é lícito', 'é ilícito', 'não se admite', 'deve ser observado', 'é obrigatório', 'é vedado', 'firmou entendimento', 'pacificou'],
};

function calculateKeywordScore(text: string): { score: number; reasoning: string[] } {
  const textLower = text.toLowerCase();
  let score = 0;
  const reasoning: string[] = [];

  // Paradigmatic keywords - strong (+15 each)
  for (const keyword of PARADIGMATIC_KEYWORDS.strong) {
    if (textLower.includes(keyword)) {
      score += 15;
      reasoning.push(`+15: "${keyword}" (paradigmatico forte)`);
    }
  }

  // Paradigmatic keywords - moderate (+8 each)
  for (const keyword of PARADIGMATIC_KEYWORDS.moderate) {
    if (textLower.includes(keyword)) {
      score += 8;
      reasoning.push(`+8: "${keyword}" (paradigmatico moderado)`);
    }
  }

  // Paradigmatic keywords - indicators (+5 each)
  for (const keyword of PARADIGMATIC_KEYWORDS.indicators) {
    if (textLower.includes(keyword)) {
      score += 5;
      reasoning.push(`+5: "${keyword}" (indicador paradigmatico)`);
    }
  }

  // High relevance keywords (+10 each)
  for (const keyword of KEYWORDS_RELEVANCIA.high) {
    if (textLower.includes(keyword)) {
      score += 10;
      reasoning.push(`+10: "${keyword}" (alta relevancia)`);
    }
  }

  // Medium relevance keywords (+5 each)
  for (const keyword of KEYWORDS_RELEVANCIA.medium) {
    if (textLower.includes(keyword)) {
      score += 5;
      reasoning.push(`+5: "${keyword}" (media relevancia)`);
    }
  }

  // Low relevance keywords (+2 each)
  for (const keyword of KEYWORDS_RELEVANCIA.low) {
    if (textLower.includes(keyword)) {
      score += 2;
      reasoning.push(`+2: "${keyword}" (baixa relevancia)`);
    }
  }

  // Exclude keywords (-15 each)
  for (const keyword of KEYWORDS_RELEVANCIA.exclude) {
    if (textLower.includes(keyword)) {
      score -= 15;
      reasoning.push(`-15: "${keyword}" (exclusao)`);
    }
  }

  return { score, reasoning };
}

// ===========================
// Suggested courses detection
// ===========================

function detectSuggestedCourses(text: string): string[] {
  const textLower = text.toLowerCase();
  const courses: string[] = [];

  for (const [courseId, keywords] of Object.entries(CURSOS_KEYWORDS) as [string, string[]][]) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        courses.push(courseId);
        break;
      }
    }
  }

  return courses;
}

// ===========================
// Main classifier
// ===========================

/**
 * Orçamento de chamadas de IA para decisões pendentes, por execução. As rotas
 * de coleta (cron dos TCEs, ingestão do STF, cron do STJ) definem o valor no
 * início; os scrapers chamam `classifyDecision` sem o 2º argumento e consomem
 * dele. Padrão 0: sem orçamento, nada muda.
 *
 * Antes disso nenhum chamador ligava a IA, e as decisões com score 20-54
 * ficavam pendentes para sempre (459 em 26/09/2026).
 */
let orcamentoIA = 0;

export function definirOrcamentoIA(chamadas: number): void {
  orcamentoIA = Math.max(0, Math.floor(chamadas));
}

export function orcamentoIARestante(): number {
  return orcamentoIA;
}

export async function classifyDecision(
  decision: DecisionInput,
  useAI?: boolean
): Promise<ClassificationResult> {
  // Combine available text
  const combinedText = [decision.title, decision.ementa, decision.fullText || '']
    .filter(Boolean)
    .join(' ');

  // Keyword scoring
  const { score, reasoning } = calculateKeywordScore(combinedText);

  // Detect themes
  const themes = detectTemas(combinedText);

  // Detect Lei 14.133 articles
  const leiArticles = detectLeiArticles(combinedText);

  // Bonus for Lei 14.133 articles mentioned
  let finalScore = score;
  if (leiArticles.length > 0) {
    finalScore += leiArticles.length * 3;
    reasoning.push(`+${leiArticles.length * 3}: ${leiArticles.length} artigos da Lei 14.133 mencionados`);
  }

  // Detect suggested courses
  const suggestedCourses = detectSuggestedCourses(combinedText);

  // Determine approval status based on score thresholds
  let approvalStatus: ClassificationResult['approvalStatus'];
  let confidence = 0;

  // Bonus for Consulta-type decisions
  if (decision.decisionType && /consulta|prejulgado|enunciado/i.test(decision.decisionType)) {
    finalScore += 20;
    reasoning.push('+20: tipo de processo paradigmatico');
  }

  if (finalScore >= 55) {
    approvalStatus = 'auto_approved';
    confidence = Math.min(95, 60 + finalScore);
  } else if (finalScore >= 20) {
    approvalStatus = 'pending';
    confidence = Math.min(60, 30 + finalScore);
  } else {
    approvalStatus = 'auto_rejected';
    confidence = Math.min(90, 70 - finalScore);
  }

  // For pending decisions, optionally use Gemini IA for better classification
  // Também vão para a IA as rejeições por palavra-chave de texto que menciona
  // licitação: ementas curtas e em caixa alta somam poucos pontos. Em
  // 26/09/2026 a palavra-chave tinha rejeitado teses de repercussão geral como
  // "transporte público coletivo pressupõe prévia licitação" (RE 1001104).
  const rejeicaoDiscutivel = approvalStatus === 'auto_rejected' && /licita/i.test(combinedText);
  const usarIA = useAI ?? orcamentoIA > 0;
  if ((approvalStatus === 'pending' || rejeicaoDiscutivel) && usarIA) {
    if (useAI === undefined) orcamentoIA--;
    const ia = await julgarAmbiguoComIA(decision);
    if (ia && ia.veredito !== 'duvida') {
      const aprovado = ia.veredito === 'aprovar';
      return {
        relevanceScore: aprovado ? Math.max(55, ia.nota) : Math.min(19, ia.nota),
        approvalStatus: aprovado ? 'auto_approved' : 'auto_rejected',
        themes: themes.length > 0 ? themes : ia.temas,
        leiArticles,
        reasoning: [...reasoning, `IA: ${ia.motivo}`].join('; '),
        suggestedCourses: suggestedCourses.join(','),
        confidence: 70,
      };
    }
    reasoning.push(ia ? `IA em dúvida: ${ia.motivo}` : 'IA indisponível ou resposta inválida; mantida a classificação por palavra-chave');
  }

  return {
    relevanceScore: Math.max(0, Math.min(100, finalScore)),
    approvalStatus,
    themes,
    leiArticles,
    reasoning: reasoning.join('; '),
    suggestedCourses: suggestedCourses.join(','),
    confidence,
  };
}

// ===========================
// AI summary generation
// ===========================

/**
 * Gera um resumo didático de uma decisão de tribunal usando Gemini.
 * Retorna 2-4 frases focando em: contexto, decisão, importância para licitações.
 */
export async function generateDecisionSummary(
  decision: DecisionInput
): Promise<string | null> {
  const textForSummary = (decision.fullText || decision.ementa || '').slice(0, 6000);

  if (textForSummary.length < 100) return null;

  const prompt = `Resuma a seguinte decisão de tribunal em 2-4 frases claras e objetivas em português.
Foque em: (1) do que trata o processo, (2) qual foi a decisão/conclusão, (3) relevância para licitações e contratos (Lei 14.133/2021) se aplicável.
Use linguagem acessível para estudantes de Direito Administrativo. Não repita o número do processo nem dados já visíveis no cabeçalho.

Tipo: ${decision.decisionType || 'N/A'}
Título: ${decision.title}
Texto:
${textForSummary}

Responda APENAS com o resumo, sem prefixos como "Resumo:" ou marcação.`;

  try {
    const result = await queryGeminiText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 300,
      thinkingBudget: 0,
      useCache: false,
    });

    const summary = result.response.trim();
    // Sanity check: reject if too short or looks like an error
    if (summary.length < 30 || summary.startsWith('{')) return null;
    return summary;
  } catch (error) {
    apiLogger.error({ err: error instanceof Error ? error.message : error }, '[classifier] Summary generation failed:');
    return null;
  }
}

// ===========================
// AI classification (for pending decisions)
// ===========================

/** Versão do critério de julgamento dos casos duvidosos (vai para o reasoning). */
export const IA_AMBIGUOS_VERSAO = 'v3';

export interface JulgamentoIA {
  veredito: 'aprovar' | 'rejeitar' | 'duvida';
  nota: number;
  motivo: string;
  temas: string[];
}

const ESQUEMA_JULGAMENTO = {
  type: 'OBJECT',
  properties: {
    veredito: { type: 'STRING', enum: ['aprovar', 'rejeitar', 'duvida'] },
    nota: { type: 'NUMBER' },
    motivo: { type: 'STRING' },
    temas: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['veredito', 'nota', 'motivo', 'temas'],
} as const;

const PROMPT_AMBIGUOS = `Você é um jurista especializado em licitações e contratos administrativos (Lei 14.133/2021, Lei 8.666/1993, Lei 13.303/2016).

Sua função: decidir se uma decisão de tribunal entra no acervo de jurisprudência de um portal jurídico sobre licitações e contratos. O acervo existe para quem precisa saber COMO o tribunal interpreta a matéria.

APROVAR quando a decisão fixa ou aplica um entendimento jurídico reaproveitável sobre:
- licitação (modalidades, habilitação, julgamento, pesquisa de preços, edital, impugnação)
- contratação direta (dispensa, inexigibilidade, credenciamento)
- contratos administrativos (alteração, reequilíbrio, reajuste, fiscalização, extinção, sanções)
- responsabilização por irregularidade em licitação ou contrato, quando a ementa explica o fundamento
- consulta respondida em tese sobre esses temas

REJEITAR quando:
- é capa ou resumo de um contrato ou licitação concreta sem tese (partes, objeto, valor, "em exame")
- o tema é outro: pessoal, previdência, educação, saúde, tributário, contas anuais, orçamento
- é só aplicação de multa ou julgamento de regularidade sem o fundamento jurídico
- o texto é só metadado, sem conteúdo

DÚVIDA: use só quando o texto não permite decidir.

Responda em JSON conforme o schema. nota: 0-100 (relevância para o acervo). motivo: uma frase, citando o que a decisão decide. temas: até 3, em português.`;

/**
 * Critério extra para tribunais JUDICIAIS, onde o caso chega de outro ramo do
 * direito com a licitação só como contexto. Calibrado em 26/09/2026 contra 53
 * votos do editor: com esta cláusula o STF foi a 10/10 (sem ela, 8/10), mas
 * nos tribunais de contas ela derrubava prejulgados que o editor aprovou (o
 * prompt base acertou 43/43 nos TCs). Por isso só entra para judiciais.
 */
const CLAUSULA_JUDICIAIS = `

ATENÇÃO (tribunal judicial): a TESE precisa ser sobre a disciplina de licitações e contratos. Se a licitação ou o contrato é só o contexto do caso e o que se decide é matéria de outro ramo, REJEITAR. Exemplos julgados pelo editor:
- embargos sobre a retroatividade da Lei 14.230/2021 em ação de improbidade por direcionamento de licitação → a tese é de improbidade: REJEITAR
- suspensão de liminar sobre concessão de serviços não pedagógicos em escolas, decidindo requisitos de contracautela → a tese é processual e de concessão: REJEITAR
Também REJEITAR quando o que se decide é competência, requisitos de liminar ou contracautela, cabimento de recurso ou improbidade em geral.`;

const TRIBUNAIS_JUDICIAIS = /^(STF|STJ|TST|TRF\d?|TJ[A-Z]{2}|TNU)$/i;

export function promptAmbiguos(tribunalCode?: string): string {
  return TRIBUNAIS_JUDICIAIS.test((tribunalCode || '').trim()) ? PROMPT_AMBIGUOS + CLAUSULA_JUDICIAIS : PROMPT_AMBIGUOS;
}

function textoParaIA(d: DecisionInput): string {
  return `Tribunal: ${d.tribunalCode || 'n/d'}
Tipo: ${d.decisionType || 'n/d'}
Título: ${d.title}
Ementa: ${d.ementa.slice(0, 3000)}`;
}

/**
 * Julga, com IA, uma decisão que o scoring por palavra-chave deixou em
 * pendente (score 20-54). Devolve null se a chamada falhar ou a resposta vier
 * fora do schema — nesse caso a decisão continua pendente.
 */
export async function julgarAmbiguoComIA(decision: DecisionInput): Promise<JulgamentoIA | null> {
  try {
    // O modelo precisa ir explícito: forçar só o provider mantém o modelo
    // padrão da tarefa (Claude), e o Gemini responde 404.
    const { text } = await generate('classification', {
      provider: 'gemini',
      model: PRIMARY_GEMINI_MODEL,
      systemPrompt: promptAmbiguos(decision.tribunalCode),
      messages: [{ role: 'user', content: textoParaIA(decision) }],
      responseSchema: ESQUEMA_JULGAMENTO,
      temperature: 0,
      thinkingBudget: 0,
    });
    const j = JSON.parse(text || '');
    if (!['aprovar', 'rejeitar', 'duvida'].includes(j?.veredito)) return null;
    return {
      veredito: j.veredito,
      nota: Math.max(0, Math.min(100, Math.round(Number(j.nota) || 0))),
      motivo: String(j.motivo || '').trim(),
      temas: Array.isArray(j.temas) ? j.temas.map(String).slice(0, 3) : [],
    };
  } catch (error) {
    apiLogger.warn({ err: error }, '[classifier] julgamento por IA falhou');
    return null;
  }
}
