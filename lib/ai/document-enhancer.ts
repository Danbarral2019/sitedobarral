import Anthropic from '@anthropic-ai/sdk';

export interface DocumentEnhancementResult {
  summary: string;
  highlights: string[];
  keyPoints: string[];
  practicalUse: string;
  publicNotes: string;
  suggestedImportance: 'baixa' | 'media' | 'alta' | 'critica';
  tags: string[];
  leiArticles: number[];
  confidence: number;
  reasoning: string;
}

export interface DocumentToEnhance {
  title: string;
  description?: string;
  category: string;
  url?: string;
  summary?: string;
  content?: string;
}

/**
 * @deprecated Use `wizardEnhance` em `lib/ai/wizard-enhance.ts`. Esse módulo
 * combina LeiIndexer (Gemini, lê texto, regras de domínio para Art. 6 e
 * pareceres) com Claude editorial em paralelo — produz catalogação muito
 * melhor para `leiArticles` e prepara o caminho para reduzir custos.
 * Mantido apenas como referência histórica e por compatibilidade com
 * eventuais imports externos. Sem call-sites internos em 2026-05-16.
 */
export async function enhanceDocumentWithAI(
  document: DocumentToEnhance
): Promise<DocumentEnhancementResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const anthropic = new Anthropic({ apiKey });

  // Montar contexto do documento
  const documentContext = `
TÍTULO: ${document.title}

CATEGORIA: ${document.category}

${document.description ? `DESCRIÇÃO:\n${document.description}\n` : ''}

${document.summary ? `RESUMO EXISTENTE:\n${document.summary}\n` : ''}

${document.content ? `CONTEÚDO:\n${document.content}\n` : ''}

${document.url ? `URL: ${document.url}` : ''}
`.trim();

  const prompt = `Você é um assistente especializado em Direito Administrativo e Licitações, ajudando o Prof. Daniel Barral a catalogar documentos para seus cursos sobre a Lei 14.133/2021.

Analise o documento abaixo e gere um enriquecimento COMPLETO em formato JSON:

${documentContext}

Retorne APENAS um JSON (sem markdown, sem explicações) com esta estrutura EXATA:

{
  "summary": "Resumo executivo do documento em 2-3 parágrafos, destacando o que é e por que é relevante",
  "highlights": ["Destaque 1", "Destaque 2", "Destaque 3"],
  "keyPoints": ["Ponto-chave 1 (direto, conciso)", "Ponto-chave 2", "Ponto-chave 3"],
  "practicalUse": "Como o aluno pode aplicar este documento na prática profissional (2-3 frases)",
  "publicNotes": "Observação educacional do professor para os alunos, destacando aspectos importantes para estudo (2-3 frases, tom didático)",
  "suggestedImportance": "baixa|media|alta|critica",
  "tags": ["tag1", "tag2", "tag3"],
  "leiArticles": [75, 18, 6],
  "confidence": 85,
  "reasoning": "Explicação de por que esses artigos foram sugeridos e qual o nível de importância"
}

IMPORTANTE:
- "leiArticles": Liste SOMENTE números de artigos da Lei 14.133/2021 (1 a 194) que são DIRETAMENTE relacionados ao documento. Se não houver relação clara, retorne array vazio []
- "suggestedImportance":
  * "critica" = documento fundamental, leitura obrigatória
  * "alta" = muito relevante, leitura recomendada
  * "media" = relevante para casos específicos
  * "baixa" = complementar, leitura opcional
- "confidence": 0-100, baseado na qualidade/quantidade de informações disponíveis
- "publicNotes": Escreva como se fosse o Prof. Barral orientando alunos ("Este documento é essencial para...", "Atenção especial para...", etc)

ARTIGOS MAIS COMUNS DA LEI 14.133/2021 (para referência):
- Art. 6: Princípios
- Art. 18: Pesquisa de Preços
- Art. 75: Planejamento das Contratações
- Art. 92: Fiscalização de Contratos
- Art. 1-5: Âmbito de aplicação
- Art. 12-17: Processo de licitação (fases)
- Art. 174-191: Disposições penais

Retorne SOMENTE o JSON, sem formatação markdown.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Extrair JSON da resposta (pode vir com ```json ou sem)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const result: DocumentEnhancementResult = JSON.parse(jsonText);

    // Validação básica
    if (!result.summary || !result.suggestedImportance) {
      throw new Error('Resposta da IA incompleta');
    }

    // Garantir que leiArticles seja array de números
    if (result.leiArticles && Array.isArray(result.leiArticles)) {
      result.leiArticles = result.leiArticles
        .map((art) => parseInt(String(art)))
        .filter((art) => !isNaN(art) && art >= 1 && art <= 194);
    } else {
      result.leiArticles = [];
    }

    // Garantir confidence entre 0-100
    if (typeof result.confidence !== 'number' || result.confidence < 0) {
      result.confidence = 50;
    } else if (result.confidence > 100) {
      result.confidence = 100;
    }

    return result;
  } catch (error) {
    console.error('[Document Enhancer] Erro ao chamar IA:', error);

    if (error instanceof Error && error.message.includes('JSON')) {
      throw new Error('Erro ao parsear resposta da IA. Tente novamente.');
    }

    throw error;
  }
}
