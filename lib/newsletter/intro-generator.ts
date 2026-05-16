/**
 * Newsletter Intro Generator
 *
 * Uses Gemini AI to generate a monthly overview paragraph (5-10 lines)
 * for the newsletter introduction, summarizing key events of the month.
 */

import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import type { FilteredDecision } from './relevance-filter';
import { apiLogger } from "@/lib/logger";

// ===========================
// Types
// ===========================

export interface IntroGeneratorInput {
  selectedDecisions: FilteredDecision[];
  categorySummary: Record<string, number>; // category -> count
  authorContent: {
    blogPosts: Array<{ title: string }>;
    publications: Array<{ title: string; type: string }>;
    videos: Array<{ title: string }>;
  };
  legislativeChanges: Array<{ fullNumber: string; title: string }>;
  monthName: string; // "março de 2026"
  totalDocuments: number;
}

// ===========================
// Constants
// ===========================

const SYSTEM_INSTRUCTION = `Você é o Prof. Daniel Barral, especialista em Direito Administrativo, Licitações e Contratos Públicos. Escreva em tom profissional mas acolhedor, adequado para comunicação com alunos e profissionais da área.`;

function buildIntroPrompt(input: IntroGeneratorInput): string {
  const topDecisions = input.selectedDecisions
    .slice(0, 3)
    .map(d => `- ${d.title} (score: ${d.relevanceScore}): ${d.aiSummary.substring(0, 150)}`)
    .join('\n');

  const categoryList = Object.entries(input.categorySummary)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');

  const authorItems: string[] = [];
  if (input.authorContent.blogPosts.length > 0) {
    authorItems.push(`Blog: ${input.authorContent.blogPosts.map(p => p.title).join(', ')}`);
  }
  if (input.authorContent.publications.length > 0) {
    authorItems.push(`Publicações: ${input.authorContent.publications.map(p => `${p.title} (${p.type})`).join(', ')}`);
  }
  if (input.authorContent.videos.length > 0) {
    authorItems.push(`Vídeos: ${input.authorContent.videos.map(v => v.title).join(', ')}`);
  }

  const legislativeList = input.legislativeChanges.length > 0
    ? input.legislativeChanges.map(l => `- ${l.fullNumber}: ${l.title}`).join('\n')
    : 'Nenhuma alteração legislativa relevante no período.';

  return `Escreva o texto introdutório da newsletter mensal de ${input.monthName} para seus alunos e assinantes.

O texto deve ter de 5 a 10 linhas e deve:
1. Apresentar brevemente o que aconteceu de mais relevante no mês na área de licitações e contratos
2. Destacar 1-2 decisões mais importantes (das selecionadas abaixo)
3. Mencionar mudanças normativas relevantes, se houver
4. Mencionar conteúdo autoral novo (artigos, publicações), se houver
5. Criar expectativa para o que o leitor encontrará nesta edição

DADOS DO MÊS:
Total de documentos: ${input.totalDocuments}
Decisões selecionadas (top 3):
${topDecisions || 'Nenhuma decisão selecionada.'}

Documentos por categoria: ${categoryList || 'Nenhum.'}

Conteúdo autoral:
${authorItems.length > 0 ? authorItems.join('\n') : 'Nenhum conteúdo autoral no período.'}

Mudanças legislativas:
${legislativeList}

REGRAS:
- Escreva APENAS o texto do parágrafo introdutório
- NÃO inclua saudação (o "Olá, [NOME]" já é adicionado separadamente)
- NÃO use markdown
- Use HTML simples (<strong>, <em>) apenas se necessário para ênfase
- Mantenha tom profissional mas acessível
- Seja específico: mencione nomes de decisões, números de artigos, temas concretos`;
}

// ===========================
// Core Logic
// ===========================

function buildFallbackIntro(input: IntroGeneratorInput): string {
  const parts: string[] = [];

  parts.push(
    `Neste mês de ${input.monthName}, adicionamos <strong>${input.totalDocuments} novos documentos</strong> à plataforma, todos relacionados a Licitações e Contratos Públicos.`
  );

  if (input.selectedDecisions.length > 0) {
    parts.push(
      `Dentre os destaques, selecionamos <strong>${input.selectedDecisions.length} decisões</strong> de tribunais pela sua relevância para o estudo da Lei 14.133/2021.`
    );
  }

  if (input.authorContent.blogPosts.length > 0) {
    const titles = input.authorContent.blogPosts.map(p => `"${p.title}"`).join(', ');
    parts.push(`Publicamos novos artigos no blog: ${titles}.`);
  }

  if (input.legislativeChanges.length > 0) {
    parts.push(`Houve ${input.legislativeChanges.length} atualização(ões) legislativa(s) relevante(s) no período.`);
  }

  parts.push('Confira abaixo os principais destaques desta edição.');

  return parts.join(' ');
}

/**
 * Generates the newsletter intro paragraph using Gemini AI.
 * Falls back to a static template if AI generation fails.
 */
export async function generateNewsletterIntro(input: IntroGeneratorInput): Promise<string> {
  try {
    const prompt = buildIntroPrompt(input);
    const result = await queryGeminiText(prompt, {
      model: PRIMARY_GEMINI_MODEL,
      temperature: 0.8,
      maxOutputTokens: 1024,
      thinkingBudget: 0, // reescrita criativa curta; temp=0.8 já dá criatividade
      useCache: false,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const text = result.response.trim();

    // Basic validation: should be reasonable length
    if (text.length < 100 || text.length > 3000) {
      console.warn(`[Newsletter Intro] AI response length unusual (${text.length} chars), using fallback`);
      return buildFallbackIntro(input);
    }

    console.log(`[Newsletter Intro] AI intro generated (${text.length} chars, ${result.latency}ms)`);
    return text;
  } catch (error) {
    apiLogger.error({ err: error }, '[Newsletter Intro] Gemini generation failed, using fallback:');
    return buildFallbackIntro(input);
  }
}
