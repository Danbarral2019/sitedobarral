/**
 * Script de Indexação Automática - Lei 14.133
 *
 * Processa TODOS os documentos sem indexação (leiArticles vazio/null)
 * e usa IA (Gemini) para identificar artigos da Lei 14.133 relacionados.
 *
 * CARACTERÍSTICAS:
 * - Batch processing: 20 documentos por vez
 * - Rate limiting: 500ms entre chamadas (respeita limites Gemini)
 * - Progress tracking: barra de progresso e ETA
 * - Dry-run mode: simula execução sem salvar
 * - Resumo detalhado ao final
 *
 * USO:
 *   node scripts/index-all-documents.js              # Dry-run (não salva)
 *   node scripts/index-all-documents.js --execute    # Execução real
 *   node scripts/index-all-documents.js --limit 50   # Limita a 50 documentos
 *   node scripts/index-all-documents.js --category orientacao-normativa # Apenas categoria específica
 *
 * NOTA: Este script requer MCP Gemini configurado e ativo!
 */

const { PrismaClient } = require('@prisma/client');
const { callGeminiJSON } = require('../lib/gemini-helper');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Parse argumentos
const args = process.argv.slice(2);
const EXECUTE_MODE = args.includes('--execute');
const LIMIT = args.find(a => a.startsWith('--limit'))?.split('=')[1] || null;
const CATEGORY_FILTER = args.find(a => a.startsWith('--category'))?.split('=')[1] || null;

// Configurações
const BATCH_SIZE = 20;
const RATE_LIMIT_BASE_MS = 6000; // 6s = 10 req/min (respeitando quota Gemini)
const RATE_LIMIT_JITTER_MS = 500; // Variação aleatória para evitar sincronização
const MIN_CONFIDENCE = 30;
const MAX_ARTICLES = 10;
const MAX_RETRIES = 3; // Máximo de tentativas em caso de erro 429

/**
 * Prompt template para análise
 */
const ANALYSIS_PROMPT_TEMPLATE = `Você é um especialista em Direito Administrativo, Licitações e Contratos especializado na Lei 14.133/2021 (Nova Lei de Licitações).

TAREFA: Analisar o documento abaixo e identificar TODOS os artigos da Lei 14.133/2021 que são relevantes ou mencionados.

DOCUMENTO:
---
Título: {{TITLE}}
Categoria: {{CATEGORY}}
Tags: {{TAGS}}
Conteúdo: {{CONTENT}}
---

INSTRUÇÕES:
1. Identifique artigos da Lei 14.133 mencionados EXPLICITAMENTE (ex: "art. 75", "artigo 28", "Lei 14.133, art. 191")
2. Identifique artigos RELACIONADOS ao tema do documento (mesmo que não mencionados explicitamente)
3. Para cada artigo identificado, forneça:
   - Número do artigo (ex: "1", "28", "75", "184-A", "194")
   - Score de confiança (0-100):
     * 90-100: Menção explícita múltipla
     * 70-89: Menção explícita única
     * 50-69: Tema claramente relacionado
     * 30-49: Tema possivelmente relacionado
     * 0-29: Relação fraca/tangencial
   - Justificativa breve (1 frase)
   - Número de menções explícitas (0 se apenas relacionado)

4. IMPORTANTE:
   - NÃO confunda artigos de outras leis (Lei 8.666, Decreto, etc.)
   - Se o documento mencionar "Lei 14.133" genérica sem artigo específico, identifique os temas e artigos relacionados
   - Artigos "184-A" e outros com letras devem ser retornados como "184-A" (com hífen)
   - Máximo de ${MAX_ARTICLES} artigos

FORMATO DE RESPOSTA (JSON):
{
  "articles": [
    {
      "articleNumber": "75",
      "confidence": 85,
      "reasoning": "Documento trata de garantias em contratos, tema central do art. 75",
      "mentions": 2
    }
  ],
  "overallConfidence": 75,
  "summary": "Documento relacionado a garantias contratuais"
}

Responda APENAS com JSON válido, sem texto adicional.`;

/**
 * Prepara conteúdo do documento
 */
function prepareContent(document) {
  const parts = [];

  if (document.description) {
    parts.push(document.description);
  }

  if (document.content) {
    const maxLength = 4000;
    const content = document.content.substring(0, maxLength);
    parts.push(content);

    if (document.content.length > maxLength) {
      parts.push('[... conteúdo truncado]');
    }
  }

  return parts.join('\n\n') || 'Sem conteúdo disponível';
}

/**
 * Formata tags
 */
function formatTags(tags) {
  if (!tags) return 'Sem tags';

  try {
    const tagArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
    return Array.isArray(tagArray) ? tagArray.join(', ') : 'Sem tags';
  } catch {
    return String(tags);
  }
}

/**
 * Analisa um documento com Gemini
 */
async function analyzeDocument(document) {
  try {
    const content = prepareContent(document);

    const prompt = ANALYSIS_PROMPT_TEMPLATE
      .replace('{{TITLE}}', document.title)
      .replace('{{CATEGORY}}', document.category || 'N/A')
      .replace('{{TAGS}}', formatTags(document.tags))
      .replace('{{CONTENT}}', content);

    const response = await callGeminiJSON(prompt, 'gemini-3-flash-preview');

    // Filtrar por confiança mínima
    const filteredArticles = (response.articles || [])
      .filter(a => a.confidence >= MIN_CONFIDENCE)
      .slice(0, MAX_ARTICLES);

    return {
      documentId: document.id,
      articles: filteredArticles,
      autoIndexed: true,
      analyzedAt: new Date(),
      confidence: response.overallConfidence || 50,
      reasoning: response.summary || 'Análise automática via Gemini',
    };
  } catch (error) {
    console.error(`      ⚠️  Erro na análise: ${error.message}`);
    return {
      documentId: document.id,
      articles: [],
      autoIndexed: true,
      analyzedAt: new Date(),
      confidence: 0,
      reasoning: `Erro: ${error.message}`,
    };
  }
}

/**
 * Analisa documento com retry logic para 429 errors
 */
async function analyzeDocumentWithRetry(document, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await analyzeDocument(document);
    } catch (error) {
      const is429Error = error.message.includes('429') || error.message.includes('quota');

      if (is429Error && attempt < retries) {
        // Exponential backoff: 2s, 4s, 8s, etc. (máximo 60s)
        const backoffDelay = Math.min(60000, Math.pow(2, attempt) * 1000);
        console.log(`      ⏳ Rate limit atingido, aguardando ${backoffDelay/1000}s (tentativa ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        // Erro não é 429 ou esgotou tentativas
        throw error;
      }
    }
  }

  // Se chegou aqui, esgotou todas as tentativas
  return {
    documentId: document.id,
    articles: [],
    autoIndexed: true,
    analyzedAt: new Date(),
    confidence: 0,
    reasoning: `Erro: Esgotadas ${retries} tentativas devido a rate limit`,
  };
}

/**
 * Converte resultado para array de artigos
 */
function resultToLeiArticles(result) {
  return result.articles
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      const aNum = parseInt(a.articleNumber.replace(/[^0-9]/g, ''));
      const bNum = parseInt(b.articleNumber.replace(/[^0-9]/g, ''));
      return aNum - bNum;
    })
    .map(a => a.articleNumber);
}

/**
 * Gera estatísticas
 */
function getBatchStats(results) {
  const totalDocuments = results.length;
  const successfullyIndexed = results.filter(r => r.articles.length > 0).length;
  const failed = results.filter(r => r.articles.length === 0).length;

  const totalArticlesFound = results.reduce((sum, r) => sum + r.articles.length, 0);
  const avgArticlesPerDoc = totalDocuments > 0 ? (totalArticlesFound / totalDocuments).toFixed(2) : '0';
  const avgConfidence = results.length > 0
    ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(1)
    : '0';

  const articleCounts = new Map();
  results.forEach(r => {
    r.articles.forEach(a => {
      articleCounts.set(a.articleNumber, (articleCounts.get(a.articleNumber) || 0) + 1);
    });
  });

  const topArticles = Array.from(articleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([article, count]) => ({ article, count }));

  return {
    totalDocuments,
    successfullyIndexed,
    failed,
    successRate: ((successfullyIndexed / totalDocuments) * 100).toFixed(1) + '%',
    totalArticlesFound,
    avgArticlesPerDoc,
    avgConfidence: avgConfidence + '%',
    topArticles,
  };
}

/**
 * Função principal
 */
async function indexAllDocuments() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  console.log('📚 INDEXAÇÃO AUTOMÁTICA DE DOCUMENTOS - Lei 14.133\n');
  console.log(`Modo: ${EXECUTE_MODE ? '⚠️  EXECUÇÃO REAL' : '🔍 DRY-RUN (simulação)'}`);
  if (LIMIT) console.log(`Limite: ${LIMIT} documentos`);
  if (CATEGORY_FILTER) console.log(`Filtro: categoria="${CATEGORY_FILTER}"`);
  console.log('');

  try {
    // PASSO 1: Buscar documentos sem indexação
    console.log('🔍 Buscando documentos não indexados...');

    const whereClause = {
      OR: [
        { leiArticles: null },
        { leiArticles: { equals: '[]' } },
        { leiArticles: { equals: '' } },
      ],
    };

    // Aplicar filtro de categoria se especificado
    if (CATEGORY_FILTER) {
      whereClause.category = CATEGORY_FILTER;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        content: true,
        description: true,
        leiArticles: true,
      },
      take: LIMIT ? parseInt(LIMIT) : undefined,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    console.log(`   Encontrados: ${documents.length} documentos\n`);

    if (documents.length === 0) {
      console.log('✅ Nenhum documento precisa de indexação!');
      return;
    }

    // PASSO 2: Analisar documentos (batch)
    console.log('🤖 Analisando documentos com IA (Gemini)...');
    console.log(`   Processando ${documents.length} documentos em batches de ${BATCH_SIZE}`);
    console.log(`   Rate limit: ${RATE_LIMIT_BASE_MS}ms base + até ${RATE_LIMIT_JITTER_MS}ms jitter`);
    console.log(`   Retry logic: até ${MAX_RETRIES} tentativas com exponential backoff\n`);

    const analysisResults = [];
    const errors = [];

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, Math.min(i + BATCH_SIZE, documents.length));
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

      console.log(`📦 Batch ${batchNumber}/${totalBatches} (${batch.length} documentos):`);

      for (const document of batch) {
        const docIndex = i + batch.indexOf(document) + 1;
        const progress = ((docIndex / documents.length) * 100).toFixed(1);

        try {
          // Analisar documento com retry logic
          console.log(`   [${docIndex}/${documents.length}] ${progress}% - ${document.title.substring(0, 60)}...`);

          const result = await analyzeDocumentWithRetry(document);
          analysisResults.push(result);

          console.log(`      ✓ ${result.articles.length} artigos identificados (confiança: ${result.confidence}%)`);

          // Rate limiting com jitter (exceto no último documento)
          if (docIndex < documents.length) {
            const jitter = Math.random() * RATE_LIMIT_JITTER_MS;
            const delay = RATE_LIMIT_BASE_MS + jitter;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`      ❌ Erro: ${error.message}`);
          errors.push({ documentId: document.id, error: error.message });
        }
      }

      console.log('');
    }

    // PASSO 3: Salvar resultados (se em modo execute)
    if (EXECUTE_MODE) {
      console.log('💾 Salvando indexações no banco de dados...');

      let saved = 0;
      let skipped = 0;

      for (const result of analysisResults) {
        try {
          // Converter resultado para array de artigos
          const leiArticles = resultToLeiArticles(result);

          // Atualizar documento
          const autoIndexNote = `[AUTO-INDEXED ${result.analyzedAt.toISOString()}] ${result.reasoning}`;
          await prisma.document.update({
            where: { id: result.documentId },
            data: {
              leiArticles: JSON.stringify(leiArticles),
              // Adicionar metadados de indexação automática nos adminNotes (dual-write)
              adminNotes: autoIndexNote,
              notes: {
                upsert: {
                  create: {
                    adminNotes: autoIndexNote,
                    updatedAt: new Date(),
                    updatedBy: 'script:index-all-documents',
                  },
                  update: {
                    adminNotes: autoIndexNote,
                    updatedAt: new Date(),
                    updatedBy: 'script:index-all-documents',
                  },
                },
              },
            },
          });

          saved++;
          console.log(`   ✓ ${result.documentId}: ${leiArticles.length} artigos salvos`);
        } catch (error) {
          console.error(`   ❌ Erro ao salvar ${result.documentId}:`, error.message);
          skipped++;
        }
      }

      console.log(`\n✅ Indexação concluída: ${saved} salvos, ${skipped} falhas\n`);
    } else {
      console.log('🔍 DRY-RUN - Nenhuma alteração foi salva no banco.\n');
    }

    // PASSO 4: Gerar estatísticas e relatório
    console.log('📊 ESTATÍSTICAS FINAIS\n');

    const stats = getBatchStats(analysisResults);

    console.log(`Total de documentos processados: ${stats.totalDocuments}`);
    console.log(`Indexados com sucesso: ${stats.successfullyIndexed} (${stats.successRate})`);
    console.log(`Falhas: ${stats.failed}`);
    console.log(`Total de artigos encontrados: ${stats.totalArticlesFound}`);
    console.log(`Média de artigos por documento: ${stats.avgArticlesPerDoc}`);
    console.log(`Confiança média: ${stats.avgConfidence}\n`);

    if (stats.topArticles.length > 0) {
      console.log('🔝 Top 10 artigos mais frequentes:');
      stats.topArticles.forEach(({ article, count }, index) => {
        console.log(`   ${index + 1}. Artigo ${article}: ${count} documentos`);
      });
      console.log('');
    }

    // Salvar relatório JSON
    const reportPath = path.join(__dirname, '..', 'data', 'backups', `indexation-report-${timestamp}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      executeMode: EXECUTE_MODE,
      limit: LIMIT,
      categoryFilter: CATEGORY_FILTER,
      stats,
      results: analysisResults.map(r => ({
        documentId: r.documentId,
        articlesCount: r.articles.length,
        articles: r.articles.map(a => a.articleNumber),
        confidence: r.confidence,
        reasoning: r.reasoning,
      })),
      errors,
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Relatório salvo em: ${reportPath}\n`);

    // Tempo total
    const elapsedMs = Date.now() - startTime;
    const elapsedMin = (elapsedMs / 1000 / 60).toFixed(1);
    console.log(`⏱️  Tempo total: ${elapsedMin} minutos\n`);

    // Próximos passos
    if (!EXECUTE_MODE) {
      console.log('⚠️  Para executar a indexação real, rode:');
      console.log('   node scripts/index-all-documents.js --execute\n');
    }

  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
indexAllDocuments()
  .then(() => {
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });
