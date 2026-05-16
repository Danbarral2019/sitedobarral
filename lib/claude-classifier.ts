/**
 * Serviço de Classificação Avançada com Claude AI
 * Usado como fallback quando análise básica tem baixa confiança
 */

import Anthropic from '@anthropic-ai/sdk';
import { apiLogger } from "@/lib/logger";

// Função para obter cliente Claude (lazy initialization)
function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new Anthropic({
    apiKey,
  });
}

// Cursos disponíveis para o Claude sugerir
const AVAILABLE_COURSES = [
  { id: '2', slug: 'planejamento-contratacoes', title: 'Planejamento das Contratações Públicas', keywords: 'planejamento, PCA, ETP, termo de referência, projeto básico, estudo técnico preliminar, licitação, pregão, edital, registro de preços, modalidades licitatórias' },
  { id: '3', slug: 'gestao-fiscalizacao-contratos', title: 'Gestão e Fiscalização de Contratos', keywords: 'gestão contratual, fiscalização, acompanhamento, medição, pagamento, gestor, fiscal' },
  { id: '4', slug: 'processo-sancionador', title: 'Processo Administrativo Sancionador', keywords: 'sanção, penalidade, PAD, processo administrativo, infrações, multa, advertência, impedimento' },
  { id: '7', slug: 'assessoramento-juridico', title: 'Assessoramento Jurídico em Licitações', keywords: 'parecer jurídico, assessoria jurídica, consultoria, atuação consultiva, AGU, procuradoria' },
  { id: '8', slug: 'revisao-reajuste-repactuacao', title: 'Revisão, Reajuste e Repactuação', keywords: 'reequilíbrio econômico-financeiro, reajuste, repactuação, revisão contratual, álea extraordinária' },
  { id: '9', slug: 'alteracoes-contratuais', title: 'Alterações Contratuais', keywords: 'aditivo contratual, alteração contratual, acréscimo, supressão, prorrogação' },
  { id: '10', slug: 'contratacao-direta', title: 'Contratação Direta', keywords: 'dispensa de licitação, inexigibilidade, contratação direta, art. 75, emergência, notória especialização' },
];

const CATEGORIES = [
  { id: 'apostila', description: 'Material didático, apostilas, manuais, guias' },
  { id: 'acordao', description: 'Acórdãos do TCU, STF, STJ ou outros tribunais' },
  { id: 'parecer', description: 'Pareceres jurídicos, notas técnicas, manifestações da AGU' },
  { id: 'edital', description: 'Editais de licitação, avisos de licitação' },
  { id: 'artigo', description: 'Artigos doutrinários, papers acadêmicos' },
  { id: 'orientacao-normativa', description: 'Orientações Normativas da AGU (ONs)' },
  { id: 'sumula', description: 'Súmulas do TCU' },
  { id: 'consulta_tcu', description: 'Respostas a Consultas do TCU sobre licitações e contratos' },
  { id: 'informativo', description: 'Informativos de Licitações e Contratos do TCU' },
  { id: 'outro', description: 'Outros tipos de documentos' },
];

// Artigos importantes da Lei 14.133/2021 para sugestão
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEI_14133_KEY_ARTICLES = {
  // Planejamento e estudos técnicos
  planejamento: [6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24],
  // Modalidades de licitação
  modalidades: [28, 29, 30, 31, 32, 33],
  // Pregão
  pregao: [28, 29, 30, 31],
  // Dispensa e inexigibilidade
  dispensaInexigibilidade: [72, 73, 74, 75, 76, 77],
  // Contratação direta
  contratacaoDireta: [72, 73, 74, 75],
  // Registro de preços
  registroPrecos: [6, 82, 83, 84, 85],
  // Habilitação
  habilitacao: [62, 63, 64, 65, 66, 67, 68, 69, 70],
  // Julgamento
  julgamento: [33, 34, 35, 36],
  // Gestão e fiscalização
  gestaoFiscalizacao: [117, 118, 119, 120, 121, 140, 141],
  // Alterações contratuais
  alteracoes: [124, 125, 126, 127, 128, 129, 130],
  // Reequilíbrio
  reequilibrio: [124, 125],
  // Sanções
  sancoes: [155, 156, 157, 158, 159, 160, 161, 162, 163, 164],
  // Recursos
  recursos: [165, 166, 167, 168, 169],
  // Terceirização
  tercerizacao: [119, 120, 121],
};

export interface ClaudeClassificationResult {
  courseSlugs: string[]; // Pode sugerir múltiplos cursos
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'sumula' | 'consulta_tcu' | 'informativo' | 'outro';
  tags: string[];
  confidence: number;
  reasoning: string; // Explicação da classificação
  suggestedArticles: number[]; // Artigos da Lei 14.133/2021 sugeridos
}

/**
 * Busca exemplos de feedback histórico para aprendizado (few-shot learning)
 */
async function fetchFeedbackExamples(limit: number = 5): Promise<string> {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Busca documentos com feedback relevante
    const examples = await prisma.document.findMany({
      where: {
        feedbackRelevance: { not: null },
        feedbackReasoning: { not: null },
      },
      select: {
        title: true,
        description: true,
        category: true,
        courseId: true,
        feedbackRelevance: true,
        feedbackReasoning: true,
      },
      orderBy: {
        feedbackGivenAt: 'desc',
      },
      take: limit,
    });

    if (examples.length === 0) {
      return '';
    }

    // Formata exemplos para o prompt
    const formatted = examples.map((ex, i) => {
      const relevanceLabel =
        ex.feedbackRelevance === 'relevant' ? '✅ RELEVANTE' :
        ex.feedbackRelevance === 'partially-relevant' ? '⚠️ PARCIALMENTE RELEVANTE' :
        '❌ IRRELEVANTE';

      return `EXEMPLO ${i + 1}:
Título: ${ex.title}
Descrição: ${ex.description || '(sem descrição)'}
Categoria: ${ex.category}
Curso: ${ex.courseId || 'N/A'}
AVALIAÇÃO DO ESPECIALISTA: ${relevanceLabel}
RACIOCÍNIO: ${ex.feedbackReasoning}`;
    }).join('\n\n---\n\n');

    return `\n\nEXEMPLOS DE CLASSIFICAÇÕES ANTERIORES (Aprenda com estes exemplos!):\n\n${formatted}\n\n`;
  } catch (error) {
    console.warn('[Claude Classifier] Erro ao buscar exemplos de feedback:', error);
    return '';
  }
}

/**
 * Classifica documento usando Claude AI (análise semântica avançada)
 * NOVO: Inclui aprendizado baseado em feedbacks históricos (few-shot learning)
 */
export async function classifyWithClaude(
  title: string,
  description: string = ''
): Promise<ClaudeClassificationResult | null> {
  // Obtém cliente Claude (verifica API key em runtime)
  const anthropic = getClaudeClient();

  if (!anthropic) {
    console.warn('[Claude Classifier] API key não configurada. Pulando análise avançada.');
    return null;
  }

  try {
    // Busca exemplos de feedback para aprendizado
    const feedbackExamples = await fetchFeedbackExamples(5);

    const prompt = await buildClassificationPrompt(title, description, feedbackExamples);

    // claude-3-5-haiku-20241022 foi retirado em 2026-02-19 — chamadas
    // viravam 404 mascarado pelo `return null` silencioso (auditoria
    // 2026-05-16 P0.2). Migrado para Haiku 4.5 (mesma família, mais capaz).
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: 0.3, // Baixa temperatura para respostas consistentes
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extrai resposta
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse da resposta JSON
    const result = parseClaudeResponse(responseText);

    console.log('[Claude Classifier] Análise concluída:', {
      title: title.substring(0, 50),
      courses: result.courseSlugs,
      category: result.category,
      confidence: result.confidence,
      feedbackExamplesUsed: feedbackExamples.length > 0,
    });

    return result;

  } catch (error) {
    apiLogger.error({ err: error }, '[Claude Classifier] Erro ao classificar documento:');
    return null;
  }
}

/**
 * Constrói prompt para o Claude com exemplos de feedback (few-shot learning)
 */
function buildClassificationPrompt(title: string, description: string, feedbackExamples: string = ''): string {
  return `Você é um especialista em Direito Administrativo brasileiro, com foco em licitações e contratos públicos, especialmente na Lei 14.133/2021 (Nova Lei de Licitações).

TAREFA: Analise o documento abaixo e classifique-o semanticamente, sugerindo:
1. A quais cursos ele pertence
2. Sua categoria
3. Tags relevantes
4. Artigos da Lei 14.133/2021 relacionados
${feedbackExamples}
DOCUMENTO A CLASSIFICAR:
Título: ${title}
Descrição: ${description || '(sem descrição)'}

CURSOS DISPONÍVEIS:
${AVAILABLE_COURSES.map((c, i) => `${i + 1}. ${c.title} (slug: ${c.slug})
   Palavras-chave: ${c.keywords}`).join('\n')}

CATEGORIAS DISPONÍVEIS:
${CATEGORIES.map(c => `- ${c.id}: ${c.description}`).join('\n')}

ARTIGOS IMPORTANTES DA LEI 14.133/2021:
- Arts. 6-24: Planejamento (ETP, TR, DFD, análise de riscos)
- Arts. 28-33: Modalidades (pregão, concorrência, etc.)
- Arts. 72-77: Dispensa e inexigibilidade (contratação direta)
- Arts. 82-85: Registro de preços
- Arts. 62-70: Habilitação
- Arts. 117-121: Gestão e fiscalização de contratos
- Arts. 124-130: Alterações contratuais (prorrogação, acréscimo, supressão)
- Arts. 155-164: Sanções administrativas
- Arts. 165-169: Recursos administrativos

INSTRUÇÕES:
1. Analise semanticamente o conteúdo do documento
2. Sugira de 1 a 3 cursos mais relevantes (use os slugs)
3. Identifique a categoria mais adequada
4. Extraia de 3 a 8 tags relevantes (termos técnicos, leis citadas, conceitos principais)
5. Sugira de 1 a 5 artigos da Lei 14.133/2021 mais relacionados ao tema (apenas números, ex: [75, 76])
6. Avalie sua confiança na classificação (0-100%)
7. Explique brevemente o raciocínio

IMPORTANTE: Se o documento NÃO mencionar a Lei 14.133/2021 explicitamente, retorne array vazio para suggestedArticles.

RESPONDA NO FORMATO JSON EXATO:
{
  "courseSlugs": ["slug1", "slug2"],
  "category": "categoria",
  "tags": ["tag1", "tag2", "tag3"],
  "suggestedArticles": [75, 76],
  "confidence": 85,
  "reasoning": "Explicação breve da classificação e artigos sugeridos"
}

RESPONDA APENAS COM O JSON, SEM TEXTO ADICIONAL.`;
}

/**
 * Faz parse da resposta do Claude
 */
function parseClaudeResponse(responseText: string): ClaudeClassificationResult {
  try {
    // Remove possíveis markdown code blocks
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // Validação e normalização de artigos sugeridos
    const suggestedArticles = Array.isArray(parsed.suggestedArticles)
      ? parsed.suggestedArticles
          .filter((art: unknown) => typeof art === 'number' && art > 0 && art <= 194) // Lei 14.133 tem 194 artigos
          .slice(0, 10) // Máximo 10 artigos
      : [];

    // Validação e normalização
    return {
      courseSlugs: Array.isArray(parsed.courseSlugs)
        ? parsed.courseSlugs.filter((slug: string) =>
            AVAILABLE_COURSES.some(c => c.slug === slug)
          )
        : [],
      category: validateCategory(parsed.category),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 10) // Máximo 10 tags
        : [],
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      reasoning: parsed.reasoning || 'Análise semântica com Claude AI',
      suggestedArticles,
    };
  } catch (error) {
    apiLogger.error({ err: error }, '[Claude Classifier] Erro ao fazer parse da resposta:');
    apiLogger.error({ err: responseText }, 'Resposta recebida:');

    // Retorna resultado padrão em caso de erro
    return {
      courseSlugs: ['planejamento-contratacoes'], // Fallback
      category: 'outro',
      tags: [],
      confidence: 20,
      reasoning: 'Erro ao processar resposta do Claude',
      suggestedArticles: [],
    };
  }
}

/**
 * Valida categoria
 */
function validateCategory(category: string): 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'sumula' | 'consulta_tcu' | 'informativo' | 'outro' {
  const validCategories = ['apostila', 'acordao', 'parecer', 'edital', 'artigo', 'orientacao-normativa', 'sumula', 'consulta_tcu', 'informativo', 'outro'] as const;
  type ValidCategory = typeof validCategories[number];
  return validCategories.includes(category as ValidCategory)
    ? (category as ValidCategory)
    : 'outro';
}

/**
 * Verifica se Claude está disponível
 */
export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
