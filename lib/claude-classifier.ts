/**
 * Serviço de Classificação Avançada com Claude AI
 * Usado como fallback quando análise básica tem baixa confiança
 */

import Anthropic from '@anthropic-ai/sdk';

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
  { id: '1', slug: 'nova-lei-licitacoes', title: 'Nova Lei de Licitações (Lei 14.133/2021)', keywords: 'lei 14.133, licitação, pregão, edital, registro de preços, modalidades licitatórias' },
  { id: '2', slug: 'planejamento-contratacoes', title: 'Planejamento das Contratações Públicas', keywords: 'planejamento, PCA, ETP, termo de referência, projeto básico, estudo técnico preliminar' },
  { id: '3', slug: 'gestao-fiscalizacao-contratos', title: 'Gestão e Fiscalização de Contratos', keywords: 'gestão contratual, fiscalização, acompanhamento, medição, pagamento, gestor, fiscal' },
  { id: '4', slug: 'processo-sancionador', title: 'Processo Administrativo Sancionador', keywords: 'sanção, penalidade, PAD, processo administrativo, infrações, multa, advertência, impedimento' },
  { id: '5', slug: 'inovacao-contratacoes', title: 'Inovação nas Contratações Públicas', keywords: 'inovação, startup, diálogo competitivo, PMI, tecnologia, soluções inovadoras, marketplace' },
  { id: '6', slug: 'terceirizacao-formacao-precos', title: 'Terceirização e Formação de Preços', keywords: 'terceirização, planilha de custos, formação de preços, mão de obra, encargos trabalhistas' },
  { id: '7', slug: 'assessoramento-juridico', title: 'Assessoramento Jurídico', keywords: 'parecer jurídico, assessoria jurídica, consultoria, atuação consultiva, AGU, procuradoria' },
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
  { id: 'outro', description: 'Outros tipos de documentos' },
];

export interface ClaudeClassificationResult {
  courseSlugs: string[]; // Pode sugerir múltiplos cursos
  category: 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'outro';
  tags: string[];
  confidence: number;
  reasoning: string; // Explicação da classificação
}

/**
 * Classifica documento usando Claude AI (análise semântica avançada)
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
    const prompt = buildClassificationPrompt(title, description);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Haiku: rápido e econômico (~$0.25/1M tokens)
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
    });

    return result;

  } catch (error) {
    console.error('[Claude Classifier] Erro ao classificar documento:', error);
    return null;
  }
}

/**
 * Constrói prompt para o Claude
 */
function buildClassificationPrompt(title: string, description: string): string {
  return `Você é um especialista em Direito Administrativo brasileiro, com foco em licitações e contratos públicos.

TAREFA: Analise o documento abaixo e classifique-o semanticamente, sugerindo a quais cursos ele pertence, sua categoria e tags relevantes.

DOCUMENTO:
Título: ${title}
Descrição: ${description || '(sem descrição)'}

CURSOS DISPONÍVEIS:
${AVAILABLE_COURSES.map((c, i) => `${i + 1}. ${c.title} (slug: ${c.slug})
   Palavras-chave: ${c.keywords}`).join('\n')}

CATEGORIAS DISPONÍVEIS:
${CATEGORIES.map(c => `- ${c.id}: ${c.description}`).join('\n')}

INSTRUÇÕES:
1. Analise semanticamente o conteúdo do documento
2. Sugira de 1 a 3 cursos mais relevantes (use os slugs)
3. Identifique a categoria mais adequada
4. Extraia de 3 a 8 tags relevantes (termos técnicos, leis citadas, conceitos principais)
5. Avalie sua confiança na classificação (0-100%)
6. Explique brevemente o raciocínio

RESPONDA NO FORMATO JSON EXATO:
{
  "courseSlugs": ["slug1", "slug2"],
  "category": "categoria",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 85,
  "reasoning": "Explicação breve da classificação"
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
    };
  } catch (error) {
    console.error('[Claude Classifier] Erro ao fazer parse da resposta:', error);
    console.error('Resposta recebida:', responseText);

    // Retorna resultado padrão em caso de erro
    return {
      courseSlugs: ['nova-lei-licitacoes'], // Fallback
      category: 'outro',
      tags: [],
      confidence: 20,
      reasoning: 'Erro ao processar resposta do Claude',
    };
  }
}

/**
 * Valida categoria
 */
function validateCategory(category: string): 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'outro' {
  const validCategories = ['apostila', 'acordao', 'parecer', 'edital', 'artigo', 'orientacao-normativa', 'outro'];
  return validCategories.includes(category)
    ? category as any
    : 'outro';
}

/**
 * Verifica se Claude está disponível
 */
export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
