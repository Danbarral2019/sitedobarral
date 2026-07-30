/**
 * Validação ponta a ponta do fallback de chave do Gemini.
 *
 * Por que não basta "apontar a primária para uma chave inválida": chave inválida
 * devolve 400/401, e o wrapper só troca de chave em 429/RESOURCE_EXHAUSTED — de
 * propósito, para não mascarar erro de configuração. O teste falharia por motivo
 * errado.
 *
 * Aqui o 429 da PRIMEIRA tentativa é forçado por um patch em globalThis.fetch;
 * a segunda tentativa (com a chave de backup) segue para a API do Google DE
 * VERDADE. Ou seja: a troca é exercitada no código real e a chave de backup é
 * validada contra o serviço real.
 *
 * Não imprime nenhuma chave, apenas qual das duas foi usada.
 *
 * Uso:
 *   npx tsx scripts/validar-gemini-fallback.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { generateEmbedding } from '../lib/embeddings/gemini-embeddings';

const GEMINI_HOST = 'generativelanguage.googleapis.com';

/** Lê o header x-goog-api-key nas três formas aceitas pela Fetch API. */
function extrairApiKey(headers: unknown): string | undefined {
  const NOME = 'x-goog-api-key';
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(NOME) ?? undefined;
  if (Array.isArray(headers)) {
    return headers.find(([k]) => String(k).toLowerCase() === NOME)?.[1];
  }
  const obj = headers as Record<string, string>;
  const chave = Object.keys(obj).find((k) => k.toLowerCase() === NOME);
  return chave ? obj[chave] : undefined;
}

function rotulo(key: string | undefined): string {
  if (!key) return 'nenhuma';
  if (key === process.env.GEMINI_API_KEY) return 'PRIMÁRIA';
  if (key === process.env.GEMINI_API_KEY_BACKUP) return 'BACKUP';
  return 'desconhecida';
}

async function main() {
  const temPrimaria = Boolean(process.env.GEMINI_API_KEY);
  const temBackup = Boolean(process.env.GEMINI_API_KEY_BACKUP);

  console.log('Chaves carregadas do .env.local:');
  console.log(`  GEMINI_API_KEY:        ${temPrimaria ? 'presente' : 'AUSENTE'}`);
  console.log(`  GEMINI_API_KEY_BACKUP: ${temBackup ? 'presente' : 'AUSENTE'}`);
  if (!temPrimaria || !temBackup) {
    console.error('\nAs duas chaves precisam estar no .env.local para esta validação.');
    process.exit(1);
  }
  if (process.env.GEMINI_API_KEY === process.env.GEMINI_API_KEY_BACKUP) {
    console.error('\nAs duas chaves são idênticas — não há o que validar.');
    process.exit(1);
  }

  const realFetch = globalThis.fetch;
  const chamadas: string[] = [];
  let forcar429 = true;

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    // O SDK @google/genai monta init.headers como objeto Headers — acesso por
    // indexação devolve undefined; é preciso .get(). Aceita as demais formas
    // permitidas pela Fetch API por segurança.
    const key = extrairApiKey(init?.headers);

    if (!url.includes(GEMINI_HOST)) return realFetch(input, init);

    chamadas.push(rotulo(key));

    if (forcar429 && key === process.env.GEMINI_API_KEY) {
      // 429 sintético: simula cota esgotada no projeto da chave primária.
      return new Response(
        JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Qualquer outra chamada (inclusive a da backup) vai para a API real.
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    console.log('\n[1] Primária responde 429 (forçado) → esperado: troca para a backup e a API real responde');
    // generateEmbedding devolve { embedding, model, dimension } — não o array cru.
    const r1 = await generateEmbedding('teste de validação do fallback de chave');
    console.log(`    sequência de chaves usadas: ${chamadas.join(' → ')}`);
    console.log(`    embedding recebido: ${r1.embedding.length} dimensões`);
    const ok1 =
      chamadas.length === 2 &&
      chamadas[0] === 'PRIMÁRIA' &&
      chamadas[1] === 'BACKUP' &&
      r1.embedding.length > 0;
    console.log(`    resultado: ${ok1 ? 'OK — fallback funcionou com chave real' : 'FALHOU'}`);

    console.log('\n[2] Sem forçar 429 → esperado: uma única chamada, na primária');
    chamadas.length = 0;
    forcar429 = false;
    const r2 = await generateEmbedding('teste de caminho feliz');
    console.log(`    sequência de chaves usadas: ${chamadas.join(' → ')}`);
    const ok2 =
      chamadas.length === 1 && chamadas[0] === 'PRIMÁRIA' && r2.embedding.length > 0;
    console.log(`    resultado: ${ok2 ? 'OK — primária atendeu sozinha' : 'FALHOU'}`);

    console.log(`\n${ok1 && ok2 ? '✅ Fallback validado ponta a ponta.' : '❌ Validação falhou — ver acima.'}`);
    process.exit(ok1 && ok2 ? 0 : 1);
  } finally {
    globalThis.fetch = realFetch;
  }
}

main().catch((err) => {
  console.error('\nErro na validação:', err instanceof Error ? err.message : err);
  process.exit(1);
});
