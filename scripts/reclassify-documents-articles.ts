/**
 * Reclassificacao de Artigos Vinculados em Documentos (qualquer categoria)
 *
 * Usa Gemini AI para identificar artigos da Lei 14.133/2021 relacionados
 * a cada documento. Conservador: se o documento NAO trata da Lei 14.133,
 * retorna array vazio. NUNCA remove artigos existentes.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-documents-articles.ts --category=parecer-vinculante --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-documents-articles.ts --category=decor --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/reclassify-documents-articles.ts --category=orientacao-normativa --dry-run
 *
 * Flags:
 *   --category=X        Categoria obrigatoria (parecer-vinculante, decor, orientacao-normativa, etc.)
 *   --dry-run            Simula sem alterar o banco de dados
 *   --limit=N            Limitar quantidade de documentos a processar
 *   --batch-size=N       Quantidade de documentos por batch (padrao: 5)
 *   --only-empty         Processar apenas documentos SEM artigos vinculados
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
const DELAY_BETWEEN_BATCHES_MS = 1200;
const MIN_TEXT_LENGTH = 30;

// ===========================
// Types
// ===========================

interface Options {
  category: string;
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
  onlyEmpty: boolean;
}

interface GeminiResponse {
  articles: number[];
  reasoning: string;
  relevant: boolean;
}

interface ReclassifyRecord {
  documentId: string;
  title: string;
  articlesBefore: string[];
  articlesAfter: string[];
  articlesAdded: string[];
  reasoning: string;
  relevant: boolean;
}

// ===========================
// Gemini Client
// ===========================

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY nao configurada.');
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
    category: '',
    dryRun: args.includes('--dry-run'),
    limit: null,
    batchSize: 5,
    onlyEmpty: args.includes('--only-empty'),
  };

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (!isNaN(n) && n > 0) options.limit = n;
    } else if (arg.startsWith('--batch-size=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (!isNaN(n) && n > 0) options.batchSize = n;
    }
  }

  if (!options.category) {
    console.error('ERRO: --category=X obrigatorio');
    console.error('Categorias validas: parecer-vinculante, decor, orientacao-normativa, informativo, consulta_tcu');
    process.exit(1);
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

function normalizeArticleNumber(art: string | number): string {
  let s = String(art).trim();
  s = s.replace(/^Art\.?\s*/i, '');
  if (/^\d+$/.test(s)) {
    s = String(parseInt(s, 10));
  }
  return s;
}

function buildPrompt(category: string, title: string, text: string, existingArticles: string[]): string {
  const existingStr = existingArticles.length > 0
    ? existingArticles.join(', ')
    : 'Nenhum';

  // Truncate text to avoid token limits — use first 2000 chars
  const truncatedText = text.length > 2000 ? text.slice(0, 2000) + '...' : text;

  return `Voce e um especialista em Direito Administrativo brasileiro, especificamente
em licitacoes e contratos publicos (Lei 14.133/2021).

Analise o documento abaixo e determine:
1. Se ele trata DIRETAMENTE de licitacoes, contratos administrativos ou temas regulados pela Lei 14.133/2021
2. Se sim, quais artigos especificos sao relevantes

CATEGORIA: ${category}
TITULO: ${title}
CONTEUDO: "${truncatedText}"

Artigos ja vinculados: ${existingStr}

REGRAS ESTRITAS — LEIA COM MUITA ATENCAO:

PASSO 1 — RELEVANCIA (seja rigoroso):
- O documento trata DIRETAMENTE de licitacoes publicas, contratacoes diretas, contratos administrativos,
  pregao, concorrencia, dispensa, inexigibilidade, gestao/fiscalizacao de contratos, sancoes em licitacoes,
  ou planejamento de contratacoes?
- Se NAO (ex: trata de direito tributario, previdenciario, ambiental, constitucional, servidores publicos,
  convênios, royalties, energia, questoes fundiarias, sigilo fiscal, anistia, ou qualquer tema que NAO seja
  licitacoes/contratos), retorne "relevant": false e "articles": []
- Documentos sobre Lei 8.666/1993: SÓ sao relevantes se o instituto juridico tratado TEM EQUIVALENTE DIRETO
  na Lei 14.133/2021. Se nao tem, retorne "relevant": false

PASSO 2 — ARTIGOS (se relevante, seja preciso):
1. Mantenha TODOS os artigos ja vinculados (nunca remova)
2. Adicione SOMENTE artigos com relacao DIRETA e ESPECIFICA ao instituto juridico tratado
3. ARTIGOS PROIBIDOS de adicionar genericamente:
   - Art. 1, 2, 3, 4, 5 (principios gerais — so se o documento discute ESPECIFICAMENTE o principio)
   - Art. 15 (consorcios — SOMENTE se o documento trata de participacao em consorcio)
   - Art. 16 (cooperativas — SOMENTE se o documento trata de cooperativas em licitacoes)
   - Art. 6 (definicoes — SOMENTE se o documento discute uma definicao especifica)
4. MAXIMO de 8 artigos adicionais alem dos ja vinculados
5. Use apenas numeros inteiros (1 a 194). Nao inclua incisos ou paragrafos
6. Prefira PRECISAO a abrangencia — na duvida, NAO inclua
7. Para documentos sobre Lei 8.666: use a tabela de correspondencia:
   - Art. 24 (8.666, dispensa) → Art. 75 (14.133)
   - Art. 25 (8.666, inexigibilidade) → Art. 74 (14.133)
   - Art. 33 (8.666, consorcios) → Art. 15 (14.133)
   - Art. 65 (8.666, alteracoes contratuais) → Art. 124 (14.133)
   - Art. 49 (8.666, anulacao) → Art. 71 (14.133)
   - Art. 57 (8.666, duracao) → Art. 106-107 (14.133)

Responda APENAS com um JSON valido (sem markdown):
{"relevant": true, "articles": [74, 75], "reasoning": "breve justificativa"}

Se o documento NAO se relaciona com licitacoes/contratos da Lei 14.133/2021:
{"relevant": false, "articles": [], "reasoning": "Este documento trata de [assunto] sem relacao com licitacoes/contratos"}`;
}

// ===========================
// Main
// ===========================

async function main() {
  const options = parseArgs();
  const { category, dryRun, limit, batchSize, onlyEmpty } = options;

  console.log(`=== Reclassificacao de Artigos — ${category} ===\n`);
  console.log('Options:', { category, dryRun, limit, batchSize, onlyEmpty });
  console.log('');

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('ERRO: GEMINI_API_KEY nao configurada.');
      process.exit(1);
    }

    // Build where clause
    const whereClause: Record<string, unknown> = { category };

    if (onlyEmpty) {
      whereClause.OR = [
        { leiArticles: null },
        { leiArticles: '[]' },
        { leiArticles: '' },
      ];
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        leiArticles: true,
      },
      orderBy: { title: 'asc' },
      ...(limit ? { take: limit } : {}),
    });

    const totalInCategory = await prisma.document.count({ where: { category } });

    console.log(`Total na categoria "${category}": ${totalInCategory}`);
    if (onlyEmpty) console.log('Filtro: apenas documentos SEM artigos');
    console.log(`Selecionados para processar: ${documents.length}`);
    console.log('');

    if (documents.length === 0) {
      console.log('Nenhum documento para processar.');
      return;
    }

    // Process
    const results: ReclassifyRecord[] = [];
    let successCount = 0;
    let errorCount = 0;
    let addedTotal = 0;
    let unchangedCount = 0;
    let notRelevantCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const existingArticles = safeParseArray(doc.leiArticles);
      const text = doc.description || doc.content || doc.title;

      console.log(`Processing ${i + 1}/${documents.length}: ${doc.title.slice(0, 100)}`);
      console.log(`  Artigos atuais: [${existingArticles.join(', ')}]`);

      // Skip documents with very short text
      if (text.length < MIN_TEXT_LENGTH) {
        console.log(`  -> SKIP: texto muito curto (${text.length} chars)`);
        skippedCount++;
        continue;
      }

      try {
        const prompt = buildPrompt(category, doc.title, text, existingArticles);
        const rawResponse = await queryGemini(prompt);

        let parsed: GeminiResponse;
        try {
          parsed = JSON.parse(rawResponse) as GeminiResponse;
        } catch {
          console.error(`  -> ERRO ao parsear JSON: ${rawResponse.slice(0, 200)}`);
          errorCount++;
          continue;
        }

        if (!Array.isArray(parsed.articles)) {
          console.error(`  -> ERRO: resposta sem array de artigos`);
          errorCount++;
          continue;
        }

        // Not relevant to Lei 14.133
        if (parsed.relevant === false && existingArticles.length === 0) {
          console.log(`  -> NAO RELEVANTE: ${(parsed.reasoning || '').slice(0, 100)}`);
          notRelevantCount++;
          results.push({
            documentId: doc.id,
            title: doc.title,
            articlesBefore: existingArticles,
            articlesAfter: [],
            articlesAdded: [],
            reasoning: parsed.reasoning || '',
            relevant: false,
          });
          successCount++;
          continue;
        }

        // Normalize and merge
        const geminiArticles = parsed.articles
          .map(a => normalizeArticleNumber(a))
          .filter(a => a.length > 0 && /^\d+(-[A-Z])?$/.test(a));

        const existingSet = new Set(existingArticles.map(a => normalizeArticleNumber(a)));
        const mergedSet = new Set(Array.from(existingSet));

        for (const art of geminiArticles) {
          mergedSet.add(art);
        }

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
          console.log(`  -> Razao: ${(parsed.reasoning || '').slice(0, 120)}`);
          addedTotal += addedArticles.length;

          if (!dryRun) {
            await prisma.document.update({
              where: { id: doc.id },
              data: { leiArticles: JSON.stringify(mergedArticles) },
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
          relevant: parsed.relevant !== false,
        });

        successCount++;
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('429') || msg.includes('Resource has been exhausted')) {
          console.error(`  -> RATE LIMIT: aguardando 5s...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          i--; // Retry
        } else {
          console.error(`  -> ERRO:`, msg);
        }
      }

      // Rate limiting
      if ((i + 1) % batchSize === 0 && i < documents.length - 1) {
        console.log(`  [Aguardando ${DELAY_BETWEEN_BATCHES_MS}ms...]`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // Save output
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${category}-reclassified.json`);
    const outputData = {
      generatedAt: new Date().toISOString(),
      options: { category, dryRun, limit, batchSize, onlyEmpty },
      summary: {
        totalProcessed: documents.length,
        success: successCount,
        errors: errorCount,
        unchanged: unchangedCount,
        notRelevant: notRelevantCount,
        skipped: skippedCount,
        withNewArticles: results.filter(r => r.articlesAdded.length > 0).length,
        totalArticlesAdded: addedTotal,
      },
      results,
    };

    await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`\nOutput salvo em: ${outputPath}`);

    // Summary
    console.log('\n=== Resultado ===');
    console.log(`Processados: ${documents.length}`);
    console.log(`Sucesso: ${successCount}`);
    console.log(`Falhas: ${errorCount}`);
    console.log(`Nao relevantes (Lei 14.133): ${notRelevantCount}`);
    console.log(`Skipped (texto curto): ${skippedCount}`);
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
