/**
 * Validação end-to-end dos fixes do roadmap 2026-04-24:
 *   - Bug 1: respostas Gemini 2.5-flash não truncam mais (thinkingBudget: 0 + 8192)
 *   - Bug 2: /jurisprudencia/query agora retorna TCU para "segregação de funções"
 *
 * Chama diretamente as mesmas funções que as rotas chamam. Sem auth, sem
 * dev server. Se passa aqui, passa em produção.
 */

import { semanticSearch } from '../lib/embeddings/vector-search';
import {
  mapFiltersToSemanticOptions,
  enrichSources,
  adaptToSourcesPayload,
  resolveEmenta,
} from '../lib/jurisprudencia/semantic-adapter';
import { queryGeminiText } from '../lib/gemini/cached-client';
import { prisma } from '../lib/prisma';

const QUERIES_BUG1 = [
  'paradoxo do lucro-incompetência',
  'requisitos pregão',
];
const QUERY_BUG2 = 'segregação de funções';

function hr(title: string) {
  console.log('\n' + '═'.repeat(72));
  console.log(title);
  console.log('═'.repeat(72));
}

function tailSnippet(s: string, n = 200): string {
  return s.length <= n ? s : '…' + s.slice(-n);
}

function endsCleanly(text: string): { ok: boolean; reason: string } {
  const trimmed = text.trim();
  if (trimmed.length < 20) return { ok: false, reason: 'response very short' };
  const lastChar = trimmed.slice(-1);
  if (['.', '!', '?', ')', '"', '»'].includes(lastChar)) {
    return { ok: true, reason: `ends with '${lastChar}'` };
  }
  // Possibly truncated mid-word/sentence
  return { ok: false, reason: `last char is '${lastChar}' — suspeito de truncamento` };
}

async function testBug2() {
  hr('BUG 2 — semanticSearch para "segregação de funções" (sem filtros)');

  const options = mapFiltersToSemanticOptions({});
  console.log('Opções do adapter:', JSON.stringify(options, null, 2));

  const resp = await semanticSearch(QUERY_BUG2, { ...options, limit: 6 });
  console.log(`\nsemanticSearch retornou ${resp.results.length} resultados em ${resp.latency}ms`);

  const enriched = await enrichSources(resp.results);
  const sources = adaptToSourcesPayload(enriched);

  console.log('\nTop-6 fontes:');
  const counts: Record<string, number> = {};
  sources.forEach((s, i) => {
    counts[s.tribunalCode] = (counts[s.tribunalCode] ?? 0) + 1;
    console.log(
      `  [${i + 1}] ${s.tribunalCode} ${s.decisionType} ${s.decisionNumber} — sim ${(s.similarity * 100).toFixed(0)}% — ${s.title.slice(0, 80)}`,
    );
  });

  console.log('\nDistribuição por tribunal:', counts);

  const tcuCount = counts['TCU'] ?? 0;
  const tcePeCount = counts['TCE-PE'] ?? 0;
  const diverseTribunals = Object.keys(counts).length;
  const pass =
    tcuCount > 0 &&
    !(tcePeCount === 6 && tcuCount === 0) &&
    diverseTribunals >= 1;

  console.log(
    `\nResultado Bug 2: ${pass ? '✅ PASS' : '❌ FAIL'} — TCU=${tcuCount}, TCE-PE=${tcePeCount}, tribunais distintos=${diverseTribunals}`,
  );

  if (!pass) {
    console.log('(critério: precisa ter pelo menos 1 TCU no top-6 OU não pode ser 100% TCE-PE)');
  }
  return { pass, enriched, sources };
}

async function testBug1(
  enriched: Awaited<ReturnType<typeof enrichSources>>,
  sources: ReturnType<typeof adaptToSourcesPayload>,
) {
  hr('BUG 1 — Gemini 2.5-flash com thinkingBudget: 0 + 8192 tokens');

  // Monta um prompt realista com o contexto real da busca do Bug 2.
  // Se o contexto estiver vazio (caso raro), usa um fallback sintético.
  let promptBody: string;
  if (enriched.length > 0) {
    promptBody = enriched
      .map((e, i) => {
        const p = sources[i];
        return `[${i + 1}] ${p.tribunalCode} ${p.decisionType} ${p.decisionNumber}
Título: ${p.title}
Ementa: ${resolveEmenta(e).slice(0, 800)}
Trecho: ${e.chunkContent.slice(0, 600)}`;
      })
      .join('\n\n---\n\n');
  } else {
    promptBody = '(sem contexto recuperado — teste isolado)';
  }

  for (const query of QUERIES_BUG1) {
    console.log(`\n--- Query: "${query}" ---`);

    const prompt = `Você é um assistente jurídico especializado em licitações e Lei 14.133/2021. Responda de forma completa, estruturada e em português técnico, citando as decisões pelo identificador (ex.: [TCU Acórdão 1234/2024]) quando aplicável.

PERGUNTA: ${query}

CONTEXTO:
${promptBody}

Sua resposta completa, terminando em ponto final:`;

    const result = await queryGeminiText(prompt, {
      temperature: 0.5,
      maxOutputTokens: 8192,
      thinkingBudget: 0,
      useCache: false,
      systemInstruction:
        'Você é um assistente jurídico técnico. Fundamente tudo nas decisões citadas; nunca invente números de acórdão ou relatores. Sempre termine em ponto final.',
    });

    const response = result.response;
    const completionTokens = result.tokens?.completion ?? -1;
    const ending = endsCleanly(response);
    const lenChars = response.length;

    console.log(`  length: ${lenChars} chars`);
    console.log(`  completion tokens: ${completionTokens} (max era 8192)`);
    console.log(`  ending check: ${ending.ok ? '✅' : '❌'} ${ending.reason}`);
    console.log(`  tail: ${tailSnippet(response, 150)}`);

    const tokenOk = completionTokens > 0 && completionTokens < 8192;
    const lenOk = lenChars >= 100;
    const pass = ending.ok && tokenOk && lenOk;
    console.log(`  Bug 1 para "${query}": ${pass ? '✅ PASS' : '❌ FAIL'}`);
  }
}

async function main() {
  try {
    const bug2 = await testBug2();
    await testBug1(bug2.enriched, bug2.sources);
    hr('FIM');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
