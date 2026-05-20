/**
 * Reclassificacao de Artigos Vinculados em Enunciados
 *
 * Usa Gemini AI para identificar artigos da Lei 14.133/2021 tematicamente
 * relacionados a cada enunciado, alem dos ja vinculados explicitamente.
 * NUNCA remove artigos existentes — apenas adiciona novos.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-enunciados-articles.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-enunciados-articles.ts --limit 10
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-enunciados-articles.ts --entity=IBDA
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-enunciados-articles.ts --batch-size=3
 *
 * Flags:
 *   --dry-run           Simula sem alterar o banco de dados
 *   --entity=X          Filtrar por entidade (IBDA, CJF, INCP) no titulo
 *   --limit=N           Limitar quantidade de enunciados a processar
 *   --batch-size=N      Quantidade de enunciados por batch (padrao: 5)
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

// ===========================
// Configuration
// ===========================

const GEMINI_MODEL = 'gemini-3-flash-preview';
const DELAY_BETWEEN_BATCHES_MS = 1000;

// ===========================
// Types
// ===========================

interface Options {
  dryRun: boolean;
  entity: string | null;
  limit: number | null;
  batchSize: number;
}

interface GeminiResponse {
  articles: number[];
  reasoning: string;
}

interface ReclassifyRecord {
  documentId: string;
  title: string;
  articlesBefore: string[];
  articlesAfter: string[];
  articlesAdded: string[];
  reasoning: string;
}

// ===========================
// Gemini Client
// ===========================

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY nao configurada. Configure a variavel de ambiente.');
  }
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

async function queryGemini(prompt: string): Promise<string> {
  const result = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      // Extração JSON de artigos — thinking come o budget e trunca.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let text = (result.text ?? '').trim();

  // Remove markdown code blocks if present
  if (text.includes('```json')) {
    text = text.split('```json')[1].split('```')[0].trim();
  } else if (text.includes('```')) {
    text = text.split('```')[1].split('```')[0].trim();
  }

  return text;
}

// ===========================
// Helpers
// ===========================

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    dryRun: args.includes('--dry-run'),
    entity: null,
    limit: null,
    batchSize: 5,
  };

  for (const arg of args) {
    if (arg.startsWith('--entity=')) {
      options.entity = arg.split('=')[1].toUpperCase();
    } else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (!isNaN(n) && n > 0) {
        options.limit = n;
      }
    } else if (arg.startsWith('--batch-size=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (!isNaN(n) && n > 0) {
        options.batchSize = n;
      }
    }
  }

  return options;
}

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

function buildPrompt(title: string, text: string, existingArticles: string[]): string {
  const existingStr = existingArticles.length > 0
    ? existingArticles.join(', ')
    : 'Nenhum';

  return `Voce e um especialista em licitacoes e contratos (Lei 14.133/2021).

Dado o enunciado abaixo, identifique os artigos da Lei 14.133/2021
que sao DIRETAMENTE relevantes ao tema ESPECIFICO tratado.

Enunciado [${title}]: "${text}"

Artigos ja vinculados: ${existingStr}

REGRAS ESTRITAS:
1. Mantenha TODOS os artigos ja vinculados (nunca remova)
2. Adicione SOMENTE artigos com relacao DIRETA e ESPECIFICA ao tema do enunciado
3. NAO adicione artigos genericos (ex: art. 15, 16, 17 sao genericos demais para a maioria dos enunciados)
4. MAXIMO de 10 artigos adicionais alem dos ja vinculados
5. Use apenas numeros inteiros (1 a 194). Nao inclua incisos ou paragrafos
6. Prefira PRECISAO a abrangencia — so inclua se o artigo trata DIRETAMENTE do mesmo instituto juridico

Exemplo: se o enunciado trata de "consorcio", inclua art. 15 (consorcios) mas NAO inclua art. 92 (contratos em geral).

Responda APENAS com um JSON valido (sem markdown): {"articles": [15, 16], "reasoning": "breve justificativa"}`;
}

function normalizeArticleNumber(art: string | number): string {
  // Convert to string, strip non-essential characters
  let s = String(art).trim();
  // Remove "Art." prefix if present
  s = s.replace(/^Art\.?\s*/i, '');
  // Keep "184-A" as is, but strip leading zeros from numeric parts
  if (/^\d+$/.test(s)) {
    s = String(parseInt(s, 10));
  }
  return s;
}

// ===========================
// Main
// ===========================

async function main() {
  const options = parseArgs();
  const { dryRun, entity, limit, batchSize } = options;

  console.log('=== Reclassificacao de Artigos em Enunciados ===\n');
  console.log('Options:', { dryRun, entity, limit, batchSize });
  console.log('');

  try {
    // 1. Verify Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('ERRO: GEMINI_API_KEY nao configurada.');
      process.exit(1);
    }

    // 2. Fetch enunciados
    const whereClause: Record<string, unknown> = {
      category: 'enunciados',
    };

    // Filter by entity in the title (e.g., "Enunciado IBDA nº 17")
    if (entity) {
      whereClause.title = { contains: entity, mode: 'insensitive' };
    }

    const enunciados = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        leiArticles: true, leiArticlesArr: true,
        entityType: true,
      },
      orderBy: { title: 'asc' },
      ...(limit ? { take: limit } : {}),
    });

    const totalEnunciados = await prisma.document.count({
      where: { category: 'enunciados' },
    });

    console.log(`Total de enunciados no banco: ${totalEnunciados}`);
    if (entity) {
      console.log(`Filtrado por entidade: ${entity}`);
    }
    console.log(`Selecionados para processar: ${enunciados.length}`);
    console.log('');

    if (enunciados.length === 0) {
      console.log('Nenhum enunciado para processar.');
      return;
    }

    // 3. Process in batches
    const results: ReclassifyRecord[] = [];
    let successCount = 0;
    let errorCount = 0;
    let addedTotal = 0;
    let unchangedCount = 0;

    for (let i = 0; i < enunciados.length; i++) {
      const doc = enunciados[i];
      const existingArticles = safeParseArray(doc.leiArticles);
      const text = doc.description || doc.content || doc.title;

      console.log(`Processing ${i + 1}/${enunciados.length}: ${doc.title}`);
      console.log(`  Artigos atuais: [${existingArticles.join(', ')}]`);

      try {
        const prompt = buildPrompt(doc.title, text, existingArticles);
        const rawResponse = await queryGemini(prompt);

        let parsed: GeminiResponse;
        try {
          parsed = JSON.parse(rawResponse) as GeminiResponse;
        } catch {
          console.error(`  -> ERRO ao parsear JSON do Gemini: ${rawResponse.slice(0, 200)}`);
          errorCount++;
          continue;
        }

        if (!Array.isArray(parsed.articles)) {
          console.error(`  -> ERRO: resposta sem array de artigos`);
          errorCount++;
          continue;
        }

        // Normalize all article numbers
        const geminiArticles = parsed.articles
          .map(a => normalizeArticleNumber(a))
          .filter(a => a.length > 0);

        // Merge: existing + new (never remove)
        const existingSet = new Set(existingArticles.map(a => normalizeArticleNumber(a)));
        const mergedSet = new Set([...existingSet]);

        for (const art of geminiArticles) {
          mergedSet.add(art);
        }

        // Sort numerically (with 184-A special handling)
        const mergedArticles = Array.from(mergedSet).sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
          const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
          if (numA !== numB) return numA - numB;
          return a.localeCompare(b);
        });

        const addedArticles = mergedArticles.filter(a => !existingSet.has(a));

        if (addedArticles.length === 0) {
          console.log(`  -> Sem novos artigos a adicionar`);
          unchangedCount++;
        } else {
          console.log(`  -> Novos artigos: [${addedArticles.join(', ')}] (+${addedArticles.length})`);
          console.log(`  -> Lista final: [${mergedArticles.join(', ')}]`);
          console.log(`  -> Razao: ${(parsed.reasoning || '').slice(0, 120)}...`);
          addedTotal += addedArticles.length;

          // Update database
          if (!dryRun) {
            await prisma.document.update({
              where: { id: doc.id },
              data: {
                leiArticles: JSON.stringify(mergedArticles),
              },
            });
          }
        }

        results.push({
          documentId: doc.id,
          title: doc.title,
          articlesBefore: existingArticles,
          articlesAfter: mergedArticles,
          articlesAdded: addedArticles,
          reasoning: parsed.reasoning || '',
        });

        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`  -> ERRO:`, error instanceof Error ? error.message : error);
      }

      // Rate limiting: delay between batches
      if ((i + 1) % batchSize === 0 && i < enunciados.length - 1) {
        console.log(`  [Aguardando ${DELAY_BETWEEN_BATCHES_MS}ms entre batches...]`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // 4. Save output JSON
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'enunciados-reclassified.json');
    const outputData = {
      generatedAt: new Date().toISOString(),
      options: { dryRun, entity, limit, batchSize },
      summary: {
        totalProcessed: enunciados.length,
        success: successCount,
        errors: errorCount,
        unchanged: unchangedCount,
        withNewArticles: results.filter(r => r.articlesAdded.length > 0).length,
        totalArticlesAdded: addedTotal,
      },
      results,
    };

    await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`\nOutput salvo em: ${outputPath}`);

    // 5. Final summary
    console.log('\n=== Resultado ===');
    console.log(`Processados: ${enunciados.length}`);
    console.log(`Sucesso: ${successCount}`);
    console.log(`Falhas: ${errorCount}`);
    console.log(`Sem alteracao: ${unchangedCount}`);
    console.log(`Com novos artigos: ${results.filter(r => r.articlesAdded.length > 0).length}`);
    console.log(`Total de artigos adicionados: ${addedTotal}`);
    if (dryRun) {
      console.log('\n[DRY-RUN] Nenhuma alteracao foi salva no banco de dados.');
    }

  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
