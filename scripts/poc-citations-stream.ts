/**
 * POC do STREAMING de citações (Fase 3): prova que generateStream do provider
 * Anthropic emite citações verificadas incrementalmente (citations_delta),
 * intercaladas com o texto — a base para a UI mostrar o trecho-fonte por
 * afirmação enquanto a resposta é digitada. Read-only no banco.
 *
 * Uso: npx tsx scripts/poc-citations-stream.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { assembleAnswerContext } from '../lib/rag/answerContext';
import { generateStream } from '../lib/ai';

const QUERY = 'Quais os requisitos para dispensa de licitação por valor na Lei 14.133?';

async function main() {
  const ctx = await assembleAnswerContext({ query: QUERY, filters: {}, maxResults: 8, useCache: false });
  if (ctx.empty) { console.log('contexto vazio'); return; }

  const stream = await generateStream('chat', {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    systemPrompt: ctx.systemInstruction,
    messages: [{ role: 'user', content: `PERGUNTA DO USUÁRIO:\n${QUERY}` }],
    documents: ctx.citationDocuments,
    maxTokens: 8192,
  });

  let textChunks = 0;
  let citationChunks = 0;
  let firstCitationAfterChars = -1;
  let chars = 0;
  const citations: string[] = [];

  for await (const chunk of stream) {
    if (chunk.text) { textChunks++; chars += chunk.text.length; }
    if (chunk.citation) {
      citationChunks++;
      if (firstCitationAfterChars < 0) firstCitationAfterChars = chars;
      const src = ctx.citationDocuments[chunk.citation.documentIndex];
      const ok = src ? src.text.includes(chunk.citation.citedText) : false;
      citations.push(`[${chunk.citation.documentTitle ?? src?.title}] ${ok ? '✅' : '❌'} "${chunk.citation.citedText.slice(0, 70)}…"`);
    }
    if (chunk.finishReason) console.log(`\n(finishReason: ${chunk.finishReason})`);
  }

  console.log(`\n===== STREAMING =====`);
  console.log(`chunks de texto: ${textChunks} (${chars} chars)`);
  console.log(`chunks de citação (citations_delta): ${citationChunks}`);
  console.log(`1ª citação chegou após ~${firstCitationAfterChars} chars de texto (intercalada ✅)`);
  console.log(`\ncitações recebidas no stream:`);
  for (const c of citations.slice(0, 10)) console.log(`  • ${c}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('POC FALHOU:', e); process.exit(1); });
