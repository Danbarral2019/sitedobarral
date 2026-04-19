/**
 * Classificador de temas via LLM para atos normativos que não foram cobertos
 * pela heurística (scripts/enrich-legislative-acts-themes.ts).
 *
 * Usa lib/ai task 'classification' (Claude Haiku por padrão). Restringe saída
 * à taxonomia canônica de 15 temas. Valida via lib/legislative-scrapers/theme-validator.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-themes-ai.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-themes-ai.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-themes-ai.ts --limit=3
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { generate } from '@/lib/ai';
import {
  CANONICAL_THEMES,
  validateThemes,
} from '@/lib/legislative-scrapers/theme-validator';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Number.POSITIVE_INFINITY;

const DELAY_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = `Você é classificador de atos normativos sobre licitações e contratos públicos (Lei 14.133/2021). Sua tarefa: atribuir temas de uma taxonomia FIXA.`;

function buildUserPrompt(params: {
  fullNumber: string;
  ementa: string | null;
  contentHead: string | null;
}): string {
  const { fullNumber, ementa, contentHead } = params;
  return `Classifique o ato abaixo usando APENAS valores da taxonomia fixa:

TAXONOMIA FIXA (use somente estes strings exatos):
${CANONICAL_THEMES.map((t) => `- ${t}`).join('\n')}

ATO: ${fullNumber}
EMENTA: ${ementa ?? '(sem ementa)'}

TRECHO DO CONTEÚDO:
${contentHead ?? '(sem conteúdo)'}

Regras:
- Retorne JSON no formato: {"themes": ["tema1", "tema2"]}
- Máximo 4 temas
- Se nenhum tema da taxonomia encaixar bem, retorne {"themes": []}
- NÃO invente novos valores; use exatamente os strings listados acima

Responda APENAS com o JSON, sem explicação.`;
}

interface ClassificationOutcome {
  id: string;
  fullNumber: string;
  status: 'success' | 'skipped-invalid' | 'skipped-empty' | 'skipped-error';
  themes?: string[];
  reason?: string;
  tokens?: { input?: number; output?: number };
}

async function classifyOne(act: {
  id: string;
  fullNumber: string;
  ementa: string | null;
  content: string | null;
}): Promise<ClassificationOutcome> {
  const contentHead = act.content ? act.content.slice(0, 2000) : null;
  const userPrompt = buildUserPrompt({
    fullNumber: act.fullNumber,
    ementa: act.ementa,
    contentHead,
  });

  let responseText: string;
  let tokens: { input?: number; output?: number } = {};
  try {
    const resp = await generate('classification', {
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.1,
      maxTokens: 200,
      jsonMode: true,
    });
    responseText = resp.text;
    tokens = { input: resp.inputTokens, output: resp.outputTokens };
  } catch (err) {
    return {
      id: act.id,
      fullNumber: act.fullNumber,
      status: 'skipped-error',
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  // Remove markdown fences (```json ... ```) se presentes — Claude às vezes
  // envelopa JSON em code blocks apesar de jsonMode: true.
  const stripped = responseText
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return {
      id: act.id,
      fullNumber: act.fullNumber,
      status: 'skipped-invalid',
      reason: `non-JSON response: ${responseText.slice(0, 120)}`,
      tokens,
    };
  }

  const validation = validateThemes(parsed);
  if (!validation.ok) {
    return {
      id: act.id,
      fullNumber: act.fullNumber,
      status: 'skipped-invalid',
      reason: validation.reason,
      tokens,
    };
  }

  if (validation.themes!.length === 0) {
    return {
      id: act.id,
      fullNumber: act.fullNumber,
      status: 'skipped-empty',
      reason: 'LLM returned empty themes array',
      tokens,
    };
  }

  return {
    id: act.id,
    fullNumber: act.fullNumber,
    status: 'success',
    themes: validation.themes,
    tokens,
  };
}

async function main() {
  const targets = await prisma.legislativeAct.findMany({
    where: { themes: null },
    select: { id: true, fullNumber: true, ementa: true, content: true },
  });
  const toProcess = targets.slice(0, LIMIT);
  console.log(`Encontrados ${targets.length} atos sem themes.`);
  console.log(`Processando ${toProcess.length} (limit=${LIMIT}, dry-run=${DRY_RUN})\n`);

  const results: ClassificationOutcome[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const act = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${act.fullNumber}`);
    const outcome = await classifyOne(act);
    results.push(outcome);
    totalInput += outcome.tokens?.input ?? 0;
    totalOutput += outcome.tokens?.output ?? 0;

    if (outcome.status === 'success') {
      console.log(`  ✓ themes: ${JSON.stringify(outcome.themes)}`);
      if (!DRY_RUN) {
        await prisma.legislativeAct.update({
          where: { id: act.id },
          data: { themes: JSON.stringify(outcome.themes) },
        });
      }
    } else {
      console.log(`  ✗ ${outcome.status}: ${outcome.reason ?? '(sem razão)'}`);
    }

    if (i < toProcess.length - 1) await sleep(DELAY_MS);
  }

  const ok = results.filter((r) => r.status === 'success').length;
  const invalid = results.filter((r) => r.status === 'skipped-invalid').length;
  const empty = results.filter((r) => r.status === 'skipped-empty').length;
  const error = results.filter((r) => r.status === 'skipped-error').length;

  console.log(`\n=== Resumo ===`);
  console.log(`Sucesso (themes gravados): ${ok}`);
  console.log(`Pulados por resposta inválida: ${invalid}`);
  console.log(`Pulados por themes vazio: ${empty}`);
  console.log(`Pulados por erro de API: ${error}`);
  console.log(`Tokens: input=${totalInput}, output=${totalOutput}`);
  if (DRY_RUN) console.log(`\n(dry-run — nada gravado no banco)`);
}

main()
  .catch((err) => {
    console.error('ERRO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
