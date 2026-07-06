/**
 * Smoke test do Passo 3 (Fase 1): exercita assembleAnswerContext ponta-a-ponta
 * contra o banco real, confirmando que a extração preservou retrieval + montagem
 * de contexto + construção do prompt. Read-only no DB (retrieval); chama Gemini
 * para expansão/seleção de artigos.
 *
 * Uso: npx tsx scripts/smoke-answercontext.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { assembleAnswerContext } from '../lib/rag/answerContext';

const QUERIES = [
  'Quais os requisitos para dispensa de licitação por valor na Lei 14.133?',
  'É possível a contratação direta por inexigibilidade para serviços técnicos especializados?',
];

async function main() {
  for (const query of QUERIES) {
    console.log(`\n===== QUERY: ${query} =====`);
    const t0 = Date.now();
    const ctx = await assembleAnswerContext({
      query,
      filters: {},
      maxResults: 5,
      useCache: false,
    });
    const ms = Date.now() - t0;
    console.log(`empty: ${ctx.empty}`);
    if (ctx.empty) {
      console.log('⚠️ retornou vazio (sem resultados de busca)');
      continue;
    }
    console.log(`latência: ${ms}ms`);
    console.log(`totalFound: ${ctx.totalFound} | fontes formatadas: ${ctx.formattedResults.length} | legalSources: ${ctx.legalSources.length}`);
    console.log(`maxSimilarity: ${(ctx.maxSimilarity * 100).toFixed(0)}%`);
    console.log(`systemInstruction: ${ctx.systemInstruction.length} chars | synthesisPrompt: ${ctx.synthesisPrompt.length} chars`);
    console.log('Top fontes:');
    for (const r of ctx.formattedResults.slice(0, 5)) {
      console.log(`  - [${r.category}] ${r.title} (${(r.relevance * 100).toFixed(0)}%)`);
    }
    // Sanidade estrutural do prompt
    const okPrompt =
      ctx.synthesisPrompt.includes('PERGUNTA DO USUÁRIO:') &&
      ctx.synthesisPrompt.includes(query) &&
      ctx.systemInstruction.includes('FIDELIDADE ABSOLUTA');
    console.log(`prompt estruturalmente OK: ${okPrompt ? '✅' : '❌'}`);
  }
  console.log('\n=== fim do smoke ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('SMOKE FALHOU:', e); process.exit(1); });
