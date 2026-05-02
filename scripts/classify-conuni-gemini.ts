/**
 * Classifica pareceres CONUNI via Gemini.
 *
 * Pra cada doc sem `aiClassification.licitacoesContratos`, pede ao Gemini:
 *   - É relevante pra licitações/contratos?
 *   - Subtemas (planejamento, dispensa, fiscalização, sanção, etc.)
 *   - Cursos relevantes (IDs do nosso catálogo)
 *   - Artigos da Lei 14.133/2021 mencionados/aplicáveis
 *   - Confidence
 *
 * Mescla resultado com aiClassification existente (preserva conuniId, vigencia,
 * source, syncedAt do sync CONUNI).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-conuni-gemini.ts                       # dry-run, primeiros 5
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-conuni-gemini.ts --apply --limit=50    # batch piloto
 *   npx dotenv -e .env.local -- npx tsx scripts/classify-conuni-gemini.ts --apply               # full run
 */

import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from '../lib/prisma';
import { PRIMARY_GEMINI_MODEL } from '../lib/gemini/config';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : APPLY ? Infinity : 5;
const DELAY_MS = 200; // entre chamadas — Gemini 3-flash tem 1500 RPM

interface ClassificationOutput {
  licitacoesContratos: boolean;
  subtemas: string[];
  cursosRelevantes: string[];
  leiArticles: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const COURSES_DESCRIPTION = `
- "2": Planejamento das Contratações Públicas (PCA, ETP, Termo de Referência, Projeto Básico)
- "3": Gestão e Fiscalização de Contratos Administrativos (responsabilidades de gestor/fiscal, medição, pagamento)
- "4": Processo Administrativo Sancionador (apuração, contraditório, aplicação de penalidades)
- "7": Assessoramento Jurídico em Licitações (parecer jurídico, atuação consultiva)
- "8": Revisão, Reajuste e Repactuação (equilíbrio econômico-financeiro)
- "9": Alterações Contratuais (limites quantitativos/qualitativos, acréscimos/supressões)
- "10": Contratação Direta (dispensa, inexigibilidade, requisitos e procedimentos)
`.trim();

const VALID_COURSE_IDS = ['2', '3', '4', '7', '8', '9', '10'];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    licitacoesContratos: {
      type: Type.BOOLEAN,
      description: 'true se o documento trata de licitações OU contratos administrativos. false se é de outro tema (combate à corrupção sem nexo, proteção de dados, previdência, recursos humanos puros, tributário, etc.)',
    },
    subtemas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Lista curta de subtemas (3-6 palavras-chave em minúsculas). Ex: ["dispensa", "valor", "obras"], ["fiscalização", "medição"], ["sanção", "inidoneidade"]. Vazio se irrelevante.',
    },
    cursosRelevantes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'IDs dos cursos do nosso catálogo onde esse documento é útil. Ex: ["3", "10"]. Vazio se irrelevante. Use APENAS os IDs válidos do catálogo (2, 3, 4, 7, 8, 9, 10).',
    },
    leiArticles: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Números (sem prefixo "art.") dos artigos da Lei 14.133/2021 mencionados ou diretamente aplicáveis. Ex: ["72", "73", "75"]. Vazio se nenhum.',
    },
    confidence: {
      type: Type.STRING,
      enum: ['high', 'medium', 'low'],
      description: 'high se o tema é claramente identificável; medium se requer inferência; low se ementa truncada ou ambígua.',
    },
    reasoning: {
      type: Type.STRING,
      description: 'Justificativa curta (1-2 frases) da classificação.',
    },
  },
  required: ['licitacoesContratos', 'subtemas', 'cursosRelevantes', 'leiArticles', 'confidence', 'reasoning'],
};

function buildPrompt(doc: { title: string; description: string | null; content: string | null }): string {
  const fullText = [doc.title, doc.description, doc.content].filter(Boolean).join('\n\n').slice(0, 2500);
  return `Você é um classificador de documentos jurídicos da AGU sobre licitações e contratos administrativos no Brasil.

Catálogo de cursos do site (use os IDs abaixo em "cursosRelevantes"):
${COURSES_DESCRIPTION}

Analise o documento abaixo e retorne JSON conforme o schema.

REGRAS:
1. licitacoesContratos = true APENAS se o tema central for licitações, contratações públicas, contratos administrativos, gestão/fiscalização de contratos, ou regime jurídico relacionado.
2. licitacoesContratos = false se o tema for: combate à corrupção (sem nexo com licitações), proteção de dados, previdência, RH/concursos públicos, direito tributário, ações civis públicas sem objeto contratual, comunicação social, gestão financeira de uma autarquia em si, etc.
3. cursosRelevantes só inclui IDs válidos: ${VALID_COURSE_IDS.join(', ')}.
4. leiArticles deve listar artigos da Lei 14.133/2021 explicitamente citados OU diretamente aplicáveis. NÃO inclua artigos de outras leis (8.666/1993, 10.520/2002, etc.).
5. Subtemas em português, minúsculas, sem acento quando possível, palavras-chave concisas.

DOCUMENTO:
"""
${fullText}
"""`;
}

async function classifyOne(genAI: GoogleGenAI, doc: { title: string; description: string | null; content: string | null }): Promise<ClassificationOutput> {
  const result = await genAI.models.generateContent({
    model: PRIMARY_GEMINI_MODEL,
    contents: [{ text: buildPrompt(doc) }],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = result.text;
  if (!text) throw new Error('Gemini retornou texto vazio');

  const parsed = JSON.parse(text) as ClassificationOutput;
  // Sanitiza cursosRelevantes
  parsed.cursosRelevantes = (parsed.cursosRelevantes || []).filter((c) => VALID_COURSE_IDS.includes(c));
  parsed.subtemas = parsed.subtemas || [];
  parsed.leiArticles = parsed.leiArticles || [];
  return parsed;
}

async function main() {
  const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';
  console.log(`${tag} Classificando pareceres via Gemini (modelo: ${PRIMARY_GEMINI_MODEL})\n`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado');

  const genAI = new GoogleGenAI({ apiKey });

  // Buscar pareceres SEM classificacao IA. Pula os que têm override manual
  // (admin já decidiu) ou que já têm licitacoesContratos preenchido.
  const candidates = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      isPublic: true,
      AND: [
        { NOT: { aiClassification: { contains: 'licitacoesContratos' } } },
        { NOT: { aiClassification: { contains: 'licitacoesContratosManualBy' } } },
      ],
    },
    select: { id: true, title: true, description: true, content: true, aiClassification: true, category: true },
    orderBy: { uploadedAt: 'desc' },
    take: isFinite(LIMIT) ? LIMIT : undefined,
  });

  console.log(`Documentos a classificar: ${candidates.length}\n`);
  if (candidates.length === 0) {
    console.log('Nada a fazer.');
    await prisma.$disconnect();
    return;
  }

  const stats = {
    processed: 0,
    relevant: 0,
    irrelevant: 0,
    errors: 0,
    courseHits: {} as Record<string, number>,
    subtemaHits: {} as Record<string, number>,
    confidence: { high: 0, medium: 0, low: 0 },
  };

  for (let i = 0; i < candidates.length; i++) {
    const doc = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] [${doc.category}] ${doc.title.slice(0, 70)}... `);
    try {
      const cls = await classifyOne(genAI, doc);
      stats.processed++;
      if (cls.licitacoesContratos) stats.relevant++; else stats.irrelevant++;
      stats.confidence[cls.confidence]++;
      cls.cursosRelevantes.forEach((c) => stats.courseHits[c] = (stats.courseHits[c] || 0) + 1);
      cls.subtemas.forEach((s) => stats.subtemaHits[s] = (stats.subtemaHits[s] || 0) + 1);

      const flag = cls.licitacoesContratos ? '✓' : '✗';
      const cursos = cls.cursosRelevantes.length > 0 ? ` cursos=[${cls.cursosRelevantes.join(',')}]` : '';
      const arts = cls.leiArticles.length > 0 ? ` arts=[${cls.leiArticles.slice(0, 3).join(',')}]` : '';
      console.log(`${flag} (${cls.confidence})${cursos}${arts}`);
      if (!APPLY) {
        console.log(`     subtemas: [${cls.subtemas.join(', ')}]`);
        console.log(`     reasoning: ${cls.reasoning}`);
      }

      if (APPLY) {
        // Mescla com aiClassification existente
        const existing = doc.aiClassification ? safeJsonParse(doc.aiClassification) : {};
        const merged = {
          ...existing,
          licitacoesContratos: cls.licitacoesContratos,
          subtemas: cls.subtemas,
          cursosRelevantes: cls.cursosRelevantes,
          leiArticles: cls.leiArticles,
          classificationConfidence: cls.confidence,
          classificationReasoning: cls.reasoning,
          classifiedAt: new Date().toISOString(),
          classifiedBy: PRIMARY_GEMINI_MODEL,
        };
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            aiClassification: JSON.stringify(merged),
            // Também sincroniza leiArticles no campo dedicado (já existe na schema)
            ...(cls.leiArticles.length > 0 ? { leiArticles: JSON.stringify(cls.leiArticles) } : {}),
          },
        });
      }
    } catch (e) {
      stats.errors++;
      console.log(`✗ ERRO: ${(e as Error).message}`);
    }

    if (i < candidates.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n=== Estatísticas ===`);
  console.log(`Processados: ${stats.processed}`);
  console.log(`Relevantes (licitações/contratos): ${stats.relevant} (${pct(stats.relevant, stats.processed)})`);
  console.log(`Irrelevantes: ${stats.irrelevant} (${pct(stats.irrelevant, stats.processed)})`);
  console.log(`Erros: ${stats.errors}`);
  console.log(`Confidence: high=${stats.confidence.high} medium=${stats.confidence.medium} low=${stats.confidence.low}`);
  console.log(`\nDistribuição por curso:`);
  Object.entries(stats.courseHits).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  curso ${k}: ${v} docs`));
  console.log(`\nTop 10 subtemas:`);
  Object.entries(stats.subtemaHits).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  await prisma.$disconnect();
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function safeJsonParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
