/**
 * Query Understanding Module
 *
 * Analisa a query do usuário para extrair:
 * - Intenção (definitional, case-law, procedural, requirement)
 * - Filtros estruturados (ano, tribunal, categoria)
 * - Queries expandidas via HyDE (Hypothetical Document Embedding)
 *
 * Usa Gemini Flash (task 'extraction') para análise rápida e barata.
 */

import { generate } from '@/lib/ai'

export interface QueryIntent {
  type: 'definitional' | 'case-law' | 'procedural' | 'requirement' | 'comparison' | 'general'
  topics: string[]
}

export interface StructuredFilters {
  yearFrom?: number
  yearTo?: number
  tribunal?: string
  category?: string
  leiArticle?: string
}

export interface QueryUnderstanding {
  originalQuery: string
  intent: QueryIntent
  filters: StructuredFilters
  hydeDocuments: string[]
  expandedQueries: string[]
}

const UNDERSTANDING_PROMPT = `Voce e um assistente especializado em licitacoes e contratos (Lei 14.133/2021). Analise a query de busca abaixo e retorne um JSON com:

1. "intent": tipo da busca
   - "definitional": quer saber o que algo significa (ex: "o que é diálogo competitivo?")
   - "case-law": busca jurisprudência ou decisões (ex: "acórdão TCU sobre dispensa")
   - "procedural": como fazer algo (ex: "como funciona o pregão?")
   - "requirement": requisitos ou condições (ex: "requisitos para inexigibilidade")
   - "comparison": diferenças entre conceitos (ex: "dispensa vs inexigibilidade")
   - "general": outros casos

2. "topics": array de 2-4 termos-chave extraídos da query

3. "filters": objeto com filtros extraídos da query (somente se mencionados explicitamente)
   - "yearFrom": ano inicial (ex: query menciona "a partir de 2023" → 2023)
   - "yearTo": ano final
   - "tribunal": sigla do tribunal (TCU, STJ, STF, TCE-SP, etc)
   - "category": categoria do documento (acordao, parecer, enunciado, orientacao-normativa, informativo, sumula)
   - "leiArticle": número do artigo da Lei 14.133 mencionado (ex: "art. 75" → "75")

4. "hyde": array de 2 parágrafos curtos (50-80 palavras cada) que seriam trechos de um documento ideal que responderia essa query. Escreva como se fosse parte de um parecer jurídico ou acórdão real, usando linguagem técnica e citando dispositivos legais quando possível.

5. "expanded": array de 2 reformulações da query usando sinônimos jurídicos

Responda APENAS com JSON valido, sem explicações.`

export async function understandQuery(query: string): Promise<QueryUnderstanding> {
  try {
    const result = await generate('extraction', {
      systemPrompt: UNDERSTANDING_PROMPT,
      messages: [{ role: 'user', content: `QUERY: "${query}"` }],
      temperature: 0.2,
      maxTokens: 1024,
      jsonMode: true,
    })

    let text = result.text.trim()
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim()
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim()

    const parsed = JSON.parse(text)

    return {
      originalQuery: query,
      intent: {
        type: parsed.intent || 'general',
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      },
      filters: {
        yearFrom: parsed.filters?.yearFrom || undefined,
        yearTo: parsed.filters?.yearTo || undefined,
        tribunal: parsed.filters?.tribunal || undefined,
        category: parsed.filters?.category || undefined,
        leiArticle: parsed.filters?.leiArticle || undefined,
      },
      hydeDocuments: Array.isArray(parsed.hyde) ? parsed.hyde.slice(0, 3) : [],
      expandedQueries: Array.isArray(parsed.expanded) ? parsed.expanded.slice(0, 3) : [],
    }
  } catch {
    // Fallback: return original query without understanding
    return {
      originalQuery: query,
      intent: { type: 'general', topics: [] },
      filters: {},
      hydeDocuments: [],
      expandedQueries: [],
    }
  }
}
