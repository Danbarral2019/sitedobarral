/**
 * Melhoria de descrições de acórdãos TCU via Gemini AI
 *
 * Gera resumos executivos de 2-3 frases que:
 * - Explicam o que o acórdão decidiu em linguagem acessível
 * - Conectam explicitamente com licitações/contratos (Lei 14.133)
 * - Citam artigos da Lei 14.133 vinculados (se houver)
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/improve-tcu-descriptions.ts --dry-run         # Simular
 *   npx tsx scripts/improve-tcu-descriptions.ts --limit 10        # Testar com poucos
 *   npx tsx scripts/improve-tcu-descriptions.ts --concurrency 3   # Paralelas (default 3)
 *   npx tsx scripts/improve-tcu-descriptions.ts                   # Executar todos
 *   npx tsx scripts/improve-tcu-descriptions.ts --force           # Reprocessar todos
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Parse CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

function getArgValue(flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? defaultValue : val;
  }
  return defaultValue;
}

const LIMIT = getArgValue('--limit', 0);
const CONCURRENCY = getArgValue('--concurrency', 3);
const DELAY_MS = 1200; // Delay entre chamadas (ms)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// --- Prompt para geração do resumo ---
function buildPrompt(doc: {
  title: string;
  description: string | null;
  leiArticles: string | null;
  metaTcu?: {
    ementaCompleta?: string | null;
    area?: string | null;
    tema?: string | null;
    subtema?: string | null;
  } | null;
}): string {
  const artigos = doc.leiArticles ? safeParseArray(doc.leiArticles) : [];
  const artigosStr = artigos.length > 0
    ? `Artigos da Lei 14.133/2021 vinculados: ${artigos.map((a: string) => `Art. ${a}`).join(', ')}`
    : 'Nenhum artigo da Lei 14.133 vinculado especificamente.';

  return `Você é um especialista em Direito Administrativo, Licitações e Contratos.

TAREFA: Gerar um resumo executivo de 2-3 frases para o acórdão do TCU abaixo.

REGRAS:
1. O resumo deve explicar a decisão em linguagem acessível (para servidores públicos, não juristas)
2. Deve conectar claramente a decisão com a prática de licitações e contratos públicos
3. Se houver artigos da Lei 14.133/2021 vinculados, mencione-os brevemente
4. Máximo 3 frases. Seja direto e prático
5. NÃO repita o número do acórdão no resumo
6. Use voz ativa e evite jargão desnecessário
7. Retorne APENAS o resumo, sem preâmbulos

DADOS DO ACÓRDÃO:
- Título: ${doc.title}
- Área: ${doc.metaTcu?.area || 'N/A'}
- Tema: ${doc.metaTcu?.tema || 'N/A'}
- Subtema: ${doc.metaTcu?.subtema || 'N/A'}
- ${artigosStr}

Enunciado/Tese:
${doc.description || 'N/A'}

${doc.metaTcu?.ementaCompleta ? `Ementa completa:\n${doc.metaTcu.ementaCompleta.slice(0, 2000)}` : ''}

RESUMO EXECUTIVO:`;
}

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Pode ser CSV
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

// --- Chamada à API do Gemini ---
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }

  throw new Error('Resposta do Gemini sem texto');
}

// --- Main ---
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║    MELHORIA DE DESCRIÇÕES TCU VIA GEMINI AI                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não configurada. Defina em .env.local');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('🔍 MODO DRY-RUN: nenhuma alteração será feita\n');
  }

  // 1. Buscar acórdãos pendentes
  const whereCondition = FORCE
    ? { category: 'acordao' as const }
    : {
        category: 'acordao' as const,
        summary: null, // Sem resumo ainda
      };

  let docs = await prisma.document.findMany({
    where: whereCondition,
    select: {
      id: true,
      title: true,
      description: true,
      summary: true,
      leiArticles: true,
      metaTcu: {
        select: {
          ementaCompleta: true,
          area: true,
          tema: true,
          subtema: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  if (LIMIT > 0) {
    docs = docs.slice(0, LIMIT);
  }

  console.log(`📊 Acórdãos a processar: ${docs.length}${FORCE ? ' (--force: reprocessando todos)' : ''}`);
  if (LIMIT > 0) console.log(`   (limitado a ${LIMIT})`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log('');

  if (docs.length === 0) {
    console.log('✅ Nenhum acórdão pendente de resumo.');
    return;
  }

  // 2. Processar em lotes
  let processed = 0;
  let success = 0;
  let errors = 0;

  const chunks: (typeof docs)[] = [];
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    chunks.push(docs.slice(i, i + CONCURRENCY));
  }

  const startTime = Date.now();

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (doc, idx) => {
        // Delay progressivo dentro do chunk
        if (idx > 0) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS * idx));
        }

        const prompt = buildPrompt(doc);
        const summary = await callGemini(prompt);

        return { doc, summary };
      })
    );

    for (const result of results) {
      processed++;
      const progress = `[${processed}/${docs.length}]`;

      if (result.status === 'fulfilled') {
        const { doc, summary } = result.value;

        if (DRY_RUN) {
          success++;
          if (success <= 5) {
            console.log(`${progress} 📝 ${doc.title}`);
            console.log(`         → ${summary.slice(0, 150)}...`);
            console.log('');
          } else if (success % 20 === 0) {
            console.log(`${progress} ✓ ${success} resumos gerados...`);
          }
        } else {
          try {
            await prisma.document.update({
              where: { id: doc.id },
              data: {
                summary,
                description: summary, // Atualiza descrição com o resumo
                summaryGeneratedAt: new Date(),
                embeddingStatus: 'pending', // Re-indexar
              },
            });
            success++;
            if (success <= 10 || success % 50 === 0) {
              console.log(`${progress} ✓ ${doc.title}`);
            }
          } catch (err) {
            errors++;
            console.error(`${progress} ✗ Erro ao salvar ${doc.title}:`, err instanceof Error ? err.message : err);
          }
        }
      } else {
        errors++;
        console.error(`${progress} ✗ Erro Gemini:`, result.reason?.message || result.reason);
      }
    }

    // Delay entre chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  // 3. Resultado
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      RESULTADO                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`   Total processados: ${processed}`);
  console.log(`   Resumos gerados: ${success}`);
  console.log(`   Erros: ${errors}`);
  console.log(`   Tempo: ${elapsed}s`);
  console.log('');

  if (DRY_RUN) {
    console.log('💡 Execute sem --dry-run para aplicar as mudanças.');
  } else if (success > 0) {
    console.log(`💡 ${success} documentos atualizados.`);
    console.log('   Execute "npx tsx scripts/migrate-to-embeddings.ts" para re-indexar os embeddings.');
    console.log('\n✅ Melhoria de descrições concluída!');
  }
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
