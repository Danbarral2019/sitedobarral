/**
 * Script de Auditoria e Reclassificação de Pareceres AGU
 *
 * Busca pareceres (parecer-vinculante, parecer, decor) que possuem leiArticles
 * e usa Gemini para verificar se realmente tratam da Lei 14.133/2021.
 *
 * - Se NÃO trata da Lei 14.133 → limpa leiArticles e marca aiClassification
 * - Se SIM → reclassifica com artigos de alta confiança (>=60)
 *
 * Uso:
 *   npx tsx scripts/reclassify-pareceres.ts [--dry-run] [--min-confidence=60] [--category=parecer-vinculante|decor|parecer]
 *
 * Flags:
 *   --dry-run           Simula sem alterar o banco de dados
 *   --min-confidence=N  Confiança mínima para manter artigos (padrão: 60)
 *   --category=X        Filtrar por categoria específica (padrão: todas)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient({
  log: ['error'],
});

// --- Configuração ---

const GEMINI_MODEL = 'gemini-3-flash-preview';
const RATE_LIMIT_MS = 800;
const PARECER_CATEGORIES = ['parecer-vinculante', 'parecer', 'decor'];

// --- Tipos ---

interface ReclassifyResult {
  documentId: string;
  title: string;
  category: string;
  isRelated14133: boolean;
  confidence: number;
  reasoning: string;
  articlesBefore: string[];
  articlesAfter: string[];
  articlesRemoved: string[];
  articlesAdded: string[];
  articlesMaintained: string[];
  action: 'cleared' | 'reclassified' | 'unchanged' | 'error';
  error?: string;
}

interface GeminiClassificationResponse {
  isRelatedToLei14133: boolean;
  confidence: number;
  reasoning: string;
  articles: Array<{
    articleNumber: string;
    confidence: number;
    reasoning: string;
    mentions: number;
  }>;
}

// --- Parse de argumentos ---

function parseArgs(): { dryRun: boolean; minConfidence: number; category: string | null } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let minConfidence = 60;
  let category: string | null = null;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--min-confidence=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        minConfidence = val;
      }
    } else if (arg.startsWith('--category=')) {
      const val = arg.split('=')[1];
      if (PARECER_CATEGORIES.includes(val)) {
        category = val;
      } else {
        console.error(`[ERRO] Categoria invalida: ${val}. Valores validos: ${PARECER_CATEGORIES.join(', ')}`);
        process.exit(1);
      }
    }
  }

  return { dryRun, minConfidence, category };
}

// --- Parse seguro de JSON arrays ---

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

// --- Chamada Gemini ---

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        // Extração JSON curta — thinking trunca.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    let text = data.candidates[0].content.parts[0].text.trim();

    // Remover markdown code blocks se presentes
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    return text;
  }

  throw new Error('Resposta invalida do Gemini: ' + JSON.stringify(data).slice(0, 300));
}

// --- Prompt de classificação ---

function buildClassificationPrompt(doc: {
  title: string;
  description: string | null;
  content: string | null;
  category: string;
}): string {
  const contentText = [doc.description, doc.content?.substring(0, 4000)]
    .filter(Boolean)
    .join('\n\n') || 'Sem conteudo disponivel';

  return `Voce e um especialista em Direito Administrativo brasileiro.

TAREFA: Analisar o parecer/manifestacao juridica abaixo e determinar se ele trata DIRETAMENTE da Lei 14.133/2021 (Nova Lei de Licitacoes) ou de licitacoes/contratos administrativos.

DOCUMENTO:
---
Titulo: ${doc.title}
Categoria: ${doc.category}
Conteudo: ${contentText}
---

INSTRUCOES RIGOROSAS:
1. Este parecer trata DIRETAMENTE da Lei 14.133/2021 ou de licitacoes/contratos administrativos?
2. NAO considere como relevante:
   - Pareceres sobre Direito Tributario que apenas mencionam contratos de forma tangencial
   - Pareceres sobre Direito Previdenciario, Ambiental, Trabalhista, Internacional
   - Pareceres sobre temas administrativos genericos que nao tratam de licitacoes/contratos
   - Pareceres que mencionam a Lei 14.133 ou licitacoes apenas como contexto/exemplo
3. CONSIDERE como relevante APENAS se:
   - O tema CENTRAL do parecer e licitacoes, contratos administrativos ou a Lei 14.133
   - O parecer analisa diretamente dispositivos da Lei 14.133
   - O parecer trata de dispensa/inexigibilidade, pregao, concorrencia, ou outros institutos licitatorios
   - O parecer aborda gestao/fiscalizacao de contratos administrativos
4. Se for relevante, identifique artigos da Lei 14.133 APENAS com mencao EXPLICITA ou relacao direta e inequivoca

FORMATO DE RESPOSTA (JSON):
{
  "isRelatedToLei14133": true/false,
  "confidence": 0-100,
  "reasoning": "Explicacao em 1-2 frases do motivo",
  "articles": [
    {
      "articleNumber": "75",
      "confidence": 85,
      "reasoning": "Artigo citado explicitamente no parecer",
      "mentions": 2
    }
  ]
}

Se NAO for relevante, retorne articles como array vazio [].

Responda APENAS com JSON valido, sem texto adicional.`;
}

// --- Classificar um documento ---

async function classifyDocument(
  doc: {
    id: string;
    title: string;
    description: string | null;
    content: string | null;
    category: string;
    leiArticles: string | null;
  },
  minConfidence: number
): Promise<ReclassifyResult> {
  const articlesBefore = safeParseArray(doc.leiArticles);

  try {
    const prompt = buildClassificationPrompt(doc);
    const responseText = await callGemini(prompt);
    const response: GeminiClassificationResponse = JSON.parse(responseText);

    if (!response.isRelatedToLei14133) {
      // Parecer NAO trata da Lei 14.133 → limpar leiArticles
      return {
        documentId: doc.id,
        title: doc.title,
        category: doc.category,
        isRelated14133: false,
        confidence: response.confidence,
        reasoning: response.reasoning,
        articlesBefore,
        articlesAfter: [],
        articlesRemoved: articlesBefore,
        articlesAdded: [],
        articlesMaintained: [],
        action: 'cleared',
      };
    }

    // Parecer SIM trata da Lei 14.133 → reclassificar com artigos de alta confianca
    const filteredArticles = response.articles
      .filter(a => a.confidence >= minConfidence)
      .map(a => a.articleNumber);

    const articlesAfter = filteredArticles;
    const articlesRemoved = articlesBefore.filter(a => !articlesAfter.includes(a));
    const articlesAdded = articlesAfter.filter(a => !articlesBefore.includes(a));
    const articlesMaintained = articlesBefore.filter(a => articlesAfter.includes(a));

    const hasChanges = articlesRemoved.length > 0 || articlesAdded.length > 0;

    return {
      documentId: doc.id,
      title: doc.title,
      category: doc.category,
      isRelated14133: true,
      confidence: response.confidence,
      reasoning: response.reasoning,
      articlesBefore,
      articlesAfter,
      articlesRemoved,
      articlesAdded,
      articlesMaintained,
      action: hasChanges ? 'reclassified' : 'unchanged',
    };
  } catch (error) {
    return {
      documentId: doc.id,
      title: doc.title,
      category: doc.category,
      isRelated14133: false,
      confidence: 0,
      reasoning: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      articlesBefore,
      articlesAfter: articlesBefore, // Manter como estava em caso de erro
      articlesRemoved: [],
      articlesAdded: [],
      articlesMaintained: articlesBefore,
      action: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

// --- Aplicar mudancas no banco ---

async function applyChanges(result: ReclassifyResult, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  if (result.action === 'error' || result.action === 'unchanged') return;

  if (result.action === 'cleared') {
    await prisma.document.update({
      where: { id: result.documentId },
      data: {
        leiArticles: null,
        aiClassification: JSON.stringify({
          relevance: 'not-related-14133',
          confidence: result.confidence,
          reasoning: result.reasoning,
          reclassifiedAt: new Date().toISOString(),
          previousArticles: result.articlesBefore,
        }),
        embeddingStatus: 'pending',
      },
    });
  } else if (result.action === 'reclassified') {
    await prisma.document.update({
      where: { id: result.documentId },
      data: {
        leiArticles: result.articlesAfter.length > 0
          ? JSON.stringify(result.articlesAfter)
          : null,
        aiClassification: JSON.stringify({
          relevance: 'related-14133',
          confidence: result.confidence,
          reasoning: result.reasoning,
          reclassifiedAt: new Date().toISOString(),
          previousArticles: result.articlesBefore,
          articlesRemoved: result.articlesRemoved,
          articlesAdded: result.articlesAdded,
        }),
        embeddingStatus: 'pending',
      },
    });
  }
}

// --- Gerar relatorio ---

function printReport(results: ReclassifyResult[], dryRun: boolean): void {
  const cleared = results.filter(r => r.action === 'cleared');
  const reclassified = results.filter(r => r.action === 'reclassified');
  const unchanged = results.filter(r => r.action === 'unchanged');
  const errors = results.filter(r => r.action === 'error');

  console.log('\n' + '='.repeat(80));
  console.log(`RELATORIO DE RECLASSIFICACAO${dryRun ? ' (DRY RUN - nenhuma alteracao feita)' : ''}`);
  console.log('='.repeat(80));

  console.log(`\nTotal analisados: ${results.length}`);
  console.log(`  - Limpos (nao relacionados a Lei 14.133): ${cleared.length}`);
  console.log(`  - Reclassificados (artigos ajustados): ${reclassified.length}`);
  console.log(`  - Sem alteracao: ${unchanged.length}`);
  console.log(`  - Erros: ${errors.length}`);

  // Contabilizar artigos removidos/adicionados
  const totalArticlesRemoved = results.reduce((sum, r) => sum + r.articlesRemoved.length, 0);
  const totalArticlesAdded = results.reduce((sum, r) => sum + r.articlesAdded.length, 0);
  const totalArticlesMaintained = results.reduce((sum, r) => sum + r.articlesMaintained.length, 0);

  console.log(`\nArtigos totais:`);
  console.log(`  - Removidos: ${totalArticlesRemoved}`);
  console.log(`  - Adicionados: ${totalArticlesAdded}`);
  console.log(`  - Mantidos: ${totalArticlesMaintained}`);

  // Detalhes dos documentos limpos
  if (cleared.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('DOCUMENTOS LIMPOS (leiArticles removido):');
    console.log('─'.repeat(80));
    for (const r of cleared) {
      console.log(`\n  [${r.category}] ${r.title}`);
      console.log(`    ID: ${r.documentId}`);
      console.log(`    Motivo: ${r.reasoning}`);
      console.log(`    Confianca: ${r.confidence}%`);
      console.log(`    Artigos removidos: ${r.articlesRemoved.join(', ') || 'nenhum'}`);
    }
  }

  // Detalhes dos documentos reclassificados
  if (reclassified.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('DOCUMENTOS RECLASSIFICADOS:');
    console.log('─'.repeat(80));
    for (const r of reclassified) {
      console.log(`\n  [${r.category}] ${r.title}`);
      console.log(`    ID: ${r.documentId}`);
      console.log(`    Motivo: ${r.reasoning}`);
      console.log(`    Confianca: ${r.confidence}%`);
      console.log(`    Antes: [${r.articlesBefore.join(', ')}]`);
      console.log(`    Depois: [${r.articlesAfter.join(', ')}]`);
      console.log(`    Removidos: ${r.articlesRemoved.join(', ') || 'nenhum'}`);
      console.log(`    Adicionados: ${r.articlesAdded.join(', ') || 'nenhum'}`);
      console.log(`    Mantidos: ${r.articlesMaintained.join(', ') || 'nenhum'}`);
    }
  }

  // Erros
  if (errors.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('ERROS:');
    console.log('─'.repeat(80));
    for (const r of errors) {
      console.log(`\n  [${r.category}] ${r.title}`);
      console.log(`    ID: ${r.documentId}`);
      console.log(`    Erro: ${r.error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// --- Salvar relatorio JSON ---

async function saveJsonReport(results: ReclassifyResult[], dryRun: boolean): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `reclassify-pareceres-${timestamp}.json`;
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  const filepath = path.join(backupDir, filename);

  await fs.mkdir(backupDir, { recursive: true });

  const cleared = results.filter(r => r.action === 'cleared');
  const reclassified = results.filter(r => r.action === 'reclassified');
  const unchanged = results.filter(r => r.action === 'unchanged');
  const errors = results.filter(r => r.action === 'error');

  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    summary: {
      total: results.length,
      cleared: cleared.length,
      reclassified: reclassified.length,
      unchanged: unchanged.length,
      errors: errors.length,
      totalArticlesRemoved: results.reduce((sum, r) => sum + r.articlesRemoved.length, 0),
      totalArticlesAdded: results.reduce((sum, r) => sum + r.articlesAdded.length, 0),
      totalArticlesMaintained: results.reduce((sum, r) => sum + r.articlesMaintained.length, 0),
    },
    results,
  };

  await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');
  return filepath;
}

// --- Main ---

async function main(): Promise<void> {
  const { dryRun, minConfidence, category } = parseArgs();

  console.log('[Reclassificar Pareceres] Iniciando...');
  console.log(`  Modo: ${dryRun ? 'DRY RUN (sem alteracoes)' : 'PRODUCAO (alteracoes serao aplicadas)'}`);
  console.log(`  Min confidence: ${minConfidence}`);
  console.log(`  Categoria: ${category || 'todas (' + PARECER_CATEGORIES.join(', ') + ')'}`);

  // Verificar GEMINI_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    console.error('[ERRO] GEMINI_API_KEY nao configurada. Defina a variavel de ambiente.');
    process.exit(1);
  }

  // Buscar documentos com leiArticles nao-nulo nas categorias de pareceres
  const categories = category ? [category] : PARECER_CATEGORIES;

  const documents = await prisma.document.findMany({
    where: {
      category: { in: categories },
      leiArticles: { not: null },
    },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      category: true,
      leiArticles: true,
    },
    orderBy: { title: 'asc' },
  });

  console.log(`\n[Reclassificar Pareceres] ${documents.length} documentos encontrados com leiArticles.\n`);

  if (documents.length === 0) {
    console.log('Nenhum documento para processar. Saindo.');
    await prisma.$disconnect();
    return;
  }

  const results: ReclassifyResult[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = `[${i + 1}/${documents.length}]`;
    console.log(`${progress} Analisando: ${doc.title.substring(0, 80)}...`);

    const result = await classifyDocument(doc, minConfidence);
    results.push(result);

    // Aplicar mudancas
    await applyChanges(result, dryRun);

    // Log inline
    const actionLabel = {
      cleared: 'LIMPO',
      reclassified: 'RECLASSIFICADO',
      unchanged: 'SEM ALTERACAO',
      error: 'ERRO',
    }[result.action];

    console.log(`  -> ${actionLabel} (confianca: ${result.confidence}%) ${result.action === 'cleared' ? `[${result.articlesRemoved.length} artigos removidos]` : ''}`);

    // Rate limiting
    if (i < documents.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
    }
  }

  // Relatorio final
  printReport(results, dryRun);

  // Salvar relatorio JSON
  const reportPath = await saveJsonReport(results, dryRun);
  console.log(`\n[Relatorio JSON] Salvo em: ${reportPath}`);

  // Instrucao pos-execucao
  const changedCount = results.filter(r => r.action === 'cleared' || r.action === 'reclassified').length;
  if (!dryRun && changedCount > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PROXIMO PASSO: Reindexar embeddings dos ${changedCount} documentos alterados:`);
    console.log(`  npx dotenv -e .env.local -- npx tsx scripts/migrate-to-embeddings.ts`);
    console.log('='.repeat(80));
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[ERRO FATAL]', error);
  await prisma.$disconnect();
  process.exit(1);
});
