/**
 * Classificador IA para Acórdãos do TCU
 *
 * Usa IA (Claude via Anthropic API) para classificar acórdãos da planilha TCU
 * de forma contextualizada, usando TODOS os dados disponíveis.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TCUPlanilhaData, TCUEnrichmentResult } from './tcu-scraper';

export interface TCUClassificationInput {
  // Dados da planilha (sempre disponível)
  planilha: TCUPlanilhaData;

  // Dados enriquecidos (pode não estar disponível)
  enrichment?: TCUEnrichmentResult;
}

export interface TCUClassificationResult {
  success: boolean;
  numeroAcordao: string;

  // Classificação sugerida
  titulo: string;
  descricao: string;
  categoria: string; // Sempre "acordao"
  cursos: string[]; // IDs dos cursos (1, 2, 3, etc)
  tags: string[];

  // Confiança e raciocínio
  confianca: number; // 0-100
  raciocinio: string; // Explicação da IA

  error?: string;
}

/**
 * Lista de cursos disponíveis para classificação
 */
const CURSOS_DISPONIVEIS = [
  { id: '1', nome: 'Nova Lei de Licitações (Lei 14.133/2021)', keywords: ['lei 14.133', 'nova lei', 'pregão', 'registro de preços'] },
  { id: '2', nome: 'Planejamento das Contratações Públicas', keywords: ['planejamento', 'etp', 'estudo técnico', 'termo de referência'] },
  { id: '3', nome: 'Gestão e Fiscalização de Contratos', keywords: ['gestão contratual', 'fiscalização', 'acompanhamento'] },
  { id: '4', nome: 'Processo Administrativo Sancionador', keywords: ['sanção', 'penalidade', 'impedimento', 'inidoneidade'] },
  { id: '5', nome: 'Inovação nas Contratações Públicas', keywords: ['inovação', 'tecnologia', 'soluções inovadoras'] },
  { id: '6', nome: 'Terceirização e Formação de Preços', keywords: ['terceirização', 'mão de obra', 'formação de preços', 'planilha'] },
  { id: '7', nome: 'Assessoramento Jurídico na Nova Lei', keywords: ['assessoria', 'jurídico', 'parecer jurídico'] },
  { id: '8', nome: 'Revisão, Reajuste e Repactuação', keywords: ['reajuste', 'repactuação', 'equilíbrio econômico', 'revisão'] },
  { id: '9', nome: 'Alterações Contratuais', keywords: ['alteração', 'aditivo', 'prorrogação', 'acréscimo', 'supressão'] },
  { id: '10', nome: 'Contratação Direta', keywords: ['dispensa', 'inexigibilidade', 'emergência', 'contratação direta'] },
];

/**
 * Classifica um acórdão usando IA
 */
export async function classifyTCUAcordao(
  input: TCUClassificationInput
): Promise<TCUClassificationResult> {
  const startTime = Date.now();
  const { planilha, enrichment } = input;

  console.log(`[TCU Classifier] Classificando acórdão: ${planilha.acordao}`);

  try {
    // Verifica se a API key está configurada
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[TCU Classifier] ANTHROPIC_API_KEY não configurada. Usando classificação baseada em regras.');
      return classifyWithRules(input);
    }

    // Inicializa cliente Anthropic
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Constrói o prompt com TODOS os dados disponíveis
    const prompt = buildClassificationPrompt(input);

    console.log(`[TCU Classifier] Enviando para Claude API (${prompt.length} chars)...`);

    // Chama a API do Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3, // Baixa temperatura para respostas mais consistentes
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`[TCU Classifier] Resposta recebida em ${elapsedTime}ms`);

    // Parse da resposta
    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Resposta da API não é texto');
    }

    const result = parseClassificationResponse(textContent.text, planilha.acordao);

    console.log(`[TCU Classifier] Classificação concluída: ${result.cursos.length} cursos, confiança ${result.confianca}%`);

    return result;

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[TCU Classifier] Erro após ${elapsedTime}ms:`, error);

    // Fallback: classificação baseada em regras
    console.log(`[TCU Classifier] Usando classificação por regras como fallback`);
    return classifyWithRules(input);
  }
}

/**
 * Constrói o prompt para a IA
 */
function buildClassificationPrompt(input: TCUClassificationInput): string {
  const { planilha, enrichment } = input;

  return `Você é um especialista em Direito Administrativo e Licitações Públicas. Sua tarefa é classificar um Acórdão do TCU para um sistema educacional.

# DADOS DO ACÓRDÃO

**Número:** ${planilha.acordao}
**Autor da Tese:** ${planilha.autorTese}

**Enunciado (Resumo):**
${planilha.enunciado}

**Contexto Temático:**
- Área: ${planilha.area}
- Tema: ${planilha.tema}
- Subtema: ${planilha.subtema}

**Legislação Citada:**
${planilha.legislacao || 'Não informada'}

**Indexadores (Tags Originais):**
${planilha.outrosIndexadores || 'Não informados'}

**Tipo de Processo:**
${planilha.tipoProcesso}

${enrichment?.success && enrichment.ementaCompleta ? `
**Ementa Completa (Site TCU):**
${enrichment.ementaCompleta.substring(0, 1000)}${enrichment.ementaCompleta.length > 1000 ? '...' : ''}
` : ''}

${enrichment?.success && enrichment.metadados?.relator ? `
**Metadados Adicionais:**
- Relator: ${enrichment.metadados.relator}
- Data Sessão: ${enrichment.metadados.dataSessao}
- Órgão Julgador: ${enrichment.metadados.orgaoJulgador}
` : ''}

# CURSOS DISPONÍVEIS

${CURSOS_DISPONIVEIS.map(c => `${c.id}. ${c.nome}`).join('\n')}

# SUA TAREFA

Analise o acórdão e forneça a classificação no formato JSON abaixo:

\`\`\`json
{
  "titulo": "Título conciso e descritivo (máx 100 chars)",
  "descricao": "Descrição expandida que adicione contexto ao enunciado (máx 300 chars)",
  "cursos": ["1", "3"],
  "tags": ["tag1", "tag2", "tag3"],
  "confianca": 85,
  "raciocinio": "Explicação breve de por que escolheu esses cursos e tags"
}
\`\`\`

**INSTRUÇÕES:**

1. **Título:** Deve ser mais específico que só "Acórdão TCU nº X/Y". Inclua o tema principal.
   Exemplo: "Gestão contratual: obrigatoriedade de indicação de crédito orçamentário"

2. **Descrição:** Expanda o enunciado adicionando contexto. Use linguagem clara e objetiva.

3. **Cursos:** Selecione 1-3 cursos mais relevantes. Priorize por ordem de relevância.
   - Use o enunciado + área/tema/subtema + legislação para identificar os cursos
   - Se mencionar Lei 14.133 → curso 1
   - Se mencionar gestão/fiscalização → curso 3
   - Se mencionar planejamento/ETP → curso 2
   - etc.

4. **Tags:** Extraia 3-8 tags relevantes (substantivos ou expressões-chave).
   Exemplos: "crédito-orçamentário", "lei-14133", "contrato-administrativo"

5. **Confiança:** 0-100, baseado em quão clara é a relação com os cursos.

6. **Raciocínio:** 1-2 frases explicando a escolha.

**IMPORTANTE:** Retorne APENAS o JSON, sem texto adicional antes ou depois.`;
}

/**
 * Parse da resposta da IA
 */
function parseClassificationResponse(
  responseText: string,
  numeroAcordao: string
): TCUClassificationResult {
  try {
    // Remove markdown code blocks se presentes
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    // Parse JSON
    const parsed = JSON.parse(jsonText);

    // Valida campos obrigatórios
    if (!parsed.titulo || !parsed.descricao || !Array.isArray(parsed.cursos) || !Array.isArray(parsed.tags)) {
      throw new Error('Resposta da IA está faltando campos obrigatórios');
    }

    return {
      success: true,
      numeroAcordao,
      titulo: parsed.titulo.substring(0, 150),
      descricao: parsed.descricao.substring(0, 500),
      categoria: 'acordao',
      cursos: parsed.cursos.filter((c: unknown) => typeof c === 'string'),
      tags: parsed.tags.filter((t: unknown) => typeof t === 'string'),
      confianca: Math.min(100, Math.max(0, parsed.confianca || 70)),
      raciocinio: parsed.raciocinio || 'Classificação baseada em análise contextual',
    };

  } catch (error) {
    console.error('[TCU Classifier] Erro ao parsear resposta da IA:', error);
    console.error('[TCU Classifier] Resposta original:', responseText);

    throw new Error('Falha ao parsear resposta da IA: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Classificação baseada em regras (fallback quando IA não disponível)
 */
function classifyWithRules(input: TCUClassificationInput): TCUClassificationResult {
  const { planilha } = input;
  const text = `
    ${planilha.enunciado}
    ${planilha.area}
    ${planilha.tema}
    ${planilha.subtema}
    ${planilha.legislacao}
    ${planilha.outrosIndexadores}
  `.toLowerCase();

  // Identifica cursos por palavras-chave
  const cursosMatch: string[] = [];
  for (const curso of CURSOS_DISPONIVEIS) {
    for (const keyword of curso.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        if (!cursosMatch.includes(curso.id)) {
          cursosMatch.push(curso.id);
        }
        break;
      }
    }
  }

  // Se não encontrou nenhum curso, adiciona curso 1 (mais genérico)
  if (cursosMatch.length === 0) {
    cursosMatch.push('1');
  }

  // Extrai tags dos indexadores
  const tags = planilha.outrosIndexadores
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(t => t.length > 2)
    .slice(0, 8);

  // Título: número do acórdão + início do enunciado
  const titulo = `${planilha.acordao}: ${planilha.enunciado.substring(0, 80)}${planilha.enunciado.length > 80 ? '...' : ''}`;

  // Descrição: enunciado completo
  const descricao = planilha.enunciado;

  return {
    success: true,
    numeroAcordao: planilha.acordao,
    titulo,
    descricao,
    categoria: 'acordao',
    cursos: cursosMatch,
    tags,
    confianca: 60, // Baixa confiança (classificação por regras)
    raciocinio: 'Classificação automática baseada em palavras-chave (IA não disponível)',
  };
}

/**
 * Classifica múltiplos acórdãos em lote
 */
export async function classifyTCUAcordaosBatch(
  inputs: TCUClassificationInput[],
  options: {
    delayMs?: number;
    onProgress?: (current: number, total: number, result: TCUClassificationResult) => void;
  } = {}
): Promise<TCUClassificationResult[]> {
  const { delayMs = 2000, onProgress } = options;

  console.log(`[TCU Classifier Batch] Classificando ${inputs.length} acórdãos`);

  const results: TCUClassificationResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    // Classifica
    const result = await classifyTCUAcordao(input);
    results.push(result);

    // Callback de progresso
    if (onProgress) {
      onProgress(i + 1, inputs.length, result);
    }

    // Delay entre requisições (exceto última)
    if (i < inputs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[TCU Classifier Batch] Concluído: ${successCount}/${results.length} classificações bem-sucedidas`);

  return results;
}
