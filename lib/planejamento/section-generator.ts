/**
 * Gera texto-base de uma seção de ETP/TR.
 *
 * Orquestra: resolve a definição da seção → busca contexto RAG →
 * monta prompt → chama `generate('enhancement', ...)` (Claude Sonnet por
 * default, configurável via AI_ENHANCEMENT_PROVIDER/AI_ENHANCEMENT_MODEL)
 * → retorna texto + proveniência + citações.
 */
import { generate } from "@/lib/ai";
import { buildSectionContext, classifyProvenance } from "./rag";
import { getSystemPrompt } from "@/data/planejamento/prompts/system";
import type { SectionDefinition, PlanningSectionSource } from "@/data/planejamento/types";

export interface GenerateSectionInput {
  def: SectionDefinition;
  descricaoLivre: string;
  /** Rascunho atual da seção (quando `mode === 'refine'`) */
  contentMd?: string | null;
  mode: "fresh" | "refine";
  userHints?: string;
  userId?: string;
  orgao?: string;
}

export interface GenerateSectionOutput {
  text: string;
  provenance: "RAG_ANCHORED" | "PARTIALLY_ANCHORED" | "NOT_ANCHORED";
  sources: PlanningSectionSource[];
  anchorageScore: number;
  topSimilarity: number;
  model: {
    provider: string;
    modelId: string;
  };
  latencyMs: number;
  tokens: {
    input?: number;
    output?: number;
  };
}

export async function generateSectionText(
  input: GenerateSectionInput,
): Promise<GenerateSectionOutput> {
  const start = Date.now();
  const ctx = await buildSectionContext(input.def, {
    descricaoLivre: input.descricaoLivre,
    contentMd: input.contentMd,
  });

  const systemPrompt = getSystemPrompt(input.def.promptSpec.systemRef);
  const userMessage = renderUserMessage(input, ctx.layeredContext);

  const result = await generate(input.def.promptSpec.aiTask ?? "enhancement", {
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0.25,
    maxTokens: 1400,
    userId: input.userId,
  });

  return {
    text: sanitizeOutput(result.text),
    provenance: classifyProvenance(ctx),
    sources: ctx.sources,
    anchorageScore: ctx.anchorageScore,
    topSimilarity: ctx.topSimilarity,
    model: { provider: result.provider, modelId: result.modelId },
    latencyMs: Date.now() - start,
    tokens: { input: result.inputTokens, output: result.outputTokens },
  };
}

function renderUserMessage(
  input: GenerateSectionInput,
  layeredContext: string,
) {
  const filledTemplate = fillTemplate(input.def.promptSpec.userTemplate, {
    descricaoLivre: input.descricaoLivre,
    orgao: input.orgao ?? "[órgão do aluno]",
    userHints: input.userHints ?? "",
  });

  const refineBlock =
    input.mode === "refine" && input.contentMd && input.contentMd.trim().length > 0
      ? `\n\nRASCUNHO ATUAL DA SEÇÃO (a ser refinado, não reescrito do zero):\n${input.contentMd.trim()}\n`
      : "";

  const hintsBlock = input.userHints?.trim()
    ? `\n\nOBSERVAÇÕES DO ALUNO:\n${input.userHints.trim()}\n`
    : "";

  const contextBlock = layeredContext
    ? `\n\nCONTEXTO DE REFERÊNCIA (usar como base; não copiar literalmente):\n${layeredContext}\n`
    : "\n\n(Sem contexto ancorado disponível para esta seção. Mantenha-se conservador.)\n";

  return [filledTemplate, refineBlock, hintsBlock, contextBlock, instrucaoFinal()]
    .filter(Boolean)
    .join("");
}

function instrucaoFinal() {
  return `\n\nTarefa: redigir apenas o corpo da seção (sem título, cabeçalho \
ou numeração), em prosa corrida, entre 150 e 350 palavras, respeitando \
integralmente o guia de estilo do sistema. Retorne somente o texto da seção.`;
}

/**
 * Substitui placeholders {{campo}} no template. Campos ausentes viram string vazia.
 */
function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => vars[key] ?? "");
}

function sanitizeOutput(text: string): string {
  let out = text.trim();
  // Remove cercas de código que o LLM às vezes encaixa involuntariamente
  out = out.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "");
  // Remove travessões (em dash ou hyphen-minus usados como bullets)
  out = out.replace(/^\s*[—–-]\s+/gm, "");
  // Remove bullets comuns em prosa
  out = out.replace(/^\s*[*•]\s+/gm, "");
  return out.trim();
}
