/**
 * POC da Citations API (Fase 3): prova que o Claude Sonnet 5 retorna citações
 * VERIFICADAS (cited_text ancorado por trecho) contra as fontes reais do acervo.
 * Monta os documentos a partir de assembleAnswerContext e imprime resposta +
 * citações resolvidas. Read-only.
 *
 * Uso: npx tsx scripts/poc-citations.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { assembleAnswerContext } from '../lib/rag/answerContext';
import { generate } from '../lib/ai';

const QUERY = 'Quais os requisitos para dispensa de licitação por valor na Lei 14.133?';

async function main() {
  const ctx = await assembleAnswerContext({ query: QUERY, filters: {}, maxResults: 8, useCache: false });
  if (ctx.empty) {
    console.log('contexto vazio — sem fontes');
    return;
  }

  const documents = ctx.allDisplayResults.map((r) => ({
    title: r.documentTitle,
    text: r.chunkContent,
  }));
  console.log(`Fontes enviadas como documentos citáveis: ${documents.length}`);

  const { text, citations, inputTokens, outputTokens } = await generate('chat', {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    systemPrompt:
      'Você é um assistente jurídico especializado em licitações (Lei 14.133/2021). Responda à pergunta do aluno usando SOMENTE os documentos fornecidos. Cite as fontes ao afirmar algo — a API registrará a citação automaticamente. Se os documentos não bastarem, diga isso.',
    messages: [{ role: 'user', content: `PERGUNTA: ${QUERY}` }],
    documents,
    maxTokens: 8192,
  });

  console.log(`\n===== RESPOSTA (${text.length} chars) =====`);
  console.log(text.slice(0, 1200) + (text.length > 1200 ? '…' : ''));

  console.log(`\n===== CITAÇÕES VERIFICADAS: ${citations?.length ?? 0} =====`);
  for (const c of (citations ?? []).slice(0, 10)) {
    const src = documents[c.documentIndex];
    console.log(`  • [doc ${c.documentIndex}] ${c.documentTitle ?? src?.title}`);
    console.log(`      "${c.citedText.slice(0, 120)}${c.citedText.length > 120 ? '…' : ''}"`);
    // Sanidade: o cited_text deve existir literalmente na fonte
    const ok = src ? src.text.includes(c.citedText) : false;
    console.log(`      ancoragem literal na fonte: ${ok ? '✅' : '❌'}`);
  }

  console.log(`\ntokens in/out: ${inputTokens}/${outputTokens}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('POC FALHOU:', e); process.exit(1); });
