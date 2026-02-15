import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeRelevanceTCU, suggestCoursesTCU } from '@/lib/tcu-module';
import { LeiIndexer } from '@/lib/lei-indexer';
import { identifyAndAlertHighlights } from '@/lib/tcu-highlight-analyzer';
import { verifyCronAuth } from '@/lib/cron-auth';

/**
 * Cron Job: Sincronização automática de acórdãos do TCU
 *
 * Busca os 500 acórdãos mais recentes da API de dados abertos do TCU,
 * filtra os relevantes para licitações/contratos, e importa apenas os novos.
 *
 * Pipeline completo pós-importação:
 * 1. Importa acórdãos novos da API do TCU
 * 2. Gera resumos executivos via Gemini AI (summary + description)
 * 3. Indexa artigos da Lei 14.133 relacionados via Gemini (leiArticles)
 * 4. Marca embeddings como 'pending' para indexação automática pelo cron de index-jobs
 *
 * Segurança: Requer CRON_SECRET ou Authorization header
 * Agendamento: Diário às 6h (vercel.json)
 */

// Permitir até 300s para importação + enriquecimento
export const maxDuration = 300;

const TCU_API_URL = 'https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos';
const PAGE_SIZE = 500;

interface TCUApiItem {
  key?: string;
  tipo?: string;
  numeroAcordao?: string;
  anoAcordao?: string;
  titulo?: string;
  sumario?: string;
  colegiado?: string;
  relator?: string;
  dataSessao?: string;
  situacao?: string;
  urlArquivo?: string;
  urlArquivoPDF?: string;
  urlAcordao?: string;
}

function mapearColegiado(colegiado: string | null | undefined): string {
  if (!colegiado) return 'Plenário';
  const c = colegiado.trim();
  if (/1[ªa]\s*c/i.test(c) || /primeira/i.test(c)) return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || /segunda/i.test(c)) return 'Segunda Câmara';
  return 'Plenário';
}

function construirUrlTCU(numero: number, ano: number, colegiado: string | null | undefined): string {
  const col = mapearColegiado(colegiado);
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent(col)}`;
}

function parseDateTCU(dataSessao: string | undefined): Date | null {
  if (!dataSessao) return null;
  const parts = dataSessao.split('/');
  if (parts.length === 3) {
    const [dia, mes, ano] = parts;
    const date = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

// --- Enriquecimento via Gemini ---

const GEMINI_MODEL = 'gemini-2.0-flash';
const ENRICHMENT_DELAY_MS = 800; // Delay entre chamadas Gemini

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

function buildSummaryPrompt(doc: {
  title: string;
  description: string | null;
  tcuEmentaCompleta: string | null;
  tcuArea: string | null;
  tcuTema: string | null;
  tcuSubtema: string | null;
  leiArticles: string | null;
}): string {
  const artigos = safeParseArray(doc.leiArticles);
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
- Área: ${doc.tcuArea || 'N/A'}
- Tema: ${doc.tcuTema || 'N/A'}
- Subtema: ${doc.tcuSubtema || 'N/A'}
- ${artigosStr}

Enunciado/Tese:
${doc.description || 'N/A'}

${doc.tcuEmentaCompleta ? `Ementa completa:\n${doc.tcuEmentaCompleta.slice(0, 2000)}` : ''}

RESUMO EXECUTIVO:`;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
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

async function enrichNewDocuments(docIds: string[]): Promise<{
  summaries: number;
  leiIndexed: number;
  enrichErrors: number;
}> {
  if (docIds.length === 0 || !process.env.GEMINI_API_KEY) {
    return { summaries: 0, leiIndexed: 0, enrichErrors: 0 };
  }

  console.log(`[Sync TCU] Enriquecendo ${docIds.length} novos acórdãos...`);

  const docs = await prisma.document.findMany({
    where: { id: { in: docIds } },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      category: true,
      tags: true,
      tcuEmentaCompleta: true,
      tcuArea: true,
      tcuTema: true,
      tcuSubtema: true,
      leiArticles: true,
    },
  });

  let summaries = 0;
  let leiIndexed = 0;
  let enrichErrors = 0;

  for (const doc of docs) {
    // Fase 1: Indexar artigos da Lei 14.133 (roda primeiro para que o resumo possa citá-los)
    try {
      const analysis = await LeiIndexer.analyzeDocument(doc, { minConfidence: 40 });
      if (analysis.articles.length > 0) {
        const articles = LeiIndexer.resultToLeiArticles(analysis);
        await prisma.document.update({
          where: { id: doc.id },
          data: { leiArticles: JSON.stringify(articles) },
        });
        leiIndexed++;
        // Atualizar leiArticles local para o prompt do resumo
        doc.leiArticles = JSON.stringify(articles);
      }
      await new Promise(resolve => setTimeout(resolve, ENRICHMENT_DELAY_MS));
    } catch (err) {
      enrichErrors++;
      console.error(`[Sync TCU] Erro Lei-index ${doc.title}:`, err instanceof Error ? err.message : err);
    }

    // Fase 2: Gerar resumo executivo via Gemini
    try {
      const prompt = buildSummaryPrompt(doc);
      const summary = await callGemini(prompt);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          summary,
          description: summary,
          summaryGeneratedAt: new Date(),
          embeddingStatus: 'pending', // Re-indexar com nova descrição
        },
      });
      summaries++;
      await new Promise(resolve => setTimeout(resolve, ENRICHMENT_DELAY_MS));
    } catch (err) {
      enrichErrors++;
      console.error(`[Sync TCU] Erro resumo ${doc.title}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[Sync TCU] Enriquecimento: ${summaries} resumos, ${leiIndexed} Lei-indexed, ${enrichErrors} erros`);
  return { summaries, leiIndexed, enrichErrors };
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    console.log('[Sync TCU] Iniciando sincronização de acórdãos...');
    const startTime = Date.now();

    // 2. Buscar os 500 acórdãos mais recentes da API do TCU
    const url = `${TCU_API_URL}?inicio=0&quantidade=${PAGE_SIZE}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API TCU retornou ${response.status}: ${response.statusText}`);
    }

    const apiData: TCUApiItem[] = await response.json();

    if (!Array.isArray(apiData)) {
      throw new Error('Resposta da API TCU não é um array');
    }

    console.log(`[Sync TCU] ${apiData.length} acórdãos recebidos da API`);

    // 3. Filtrar relevantes para licitações/contratos
    const relevant: TCUApiItem[] = [];
    for (const item of apiData) {
      const titulo = item.titulo || '';
      const sumario = item.sumario || '';
      const { isRelevant, score } = analyzeRelevanceTCU(titulo, sumario);

      if (isRelevant && score >= 10) {
        relevant.push(item);
      }
    }

    console.log(`[Sync TCU] ${relevant.length} acórdãos relevantes (${Math.round(relevant.length / apiData.length * 100)}%)`);

    // 4. Verificar quais já existem no banco
    const existingPairs = await prisma.document.findMany({
      where: { category: 'acordao' },
      select: { acordaoNumero: true, acordaoAno: true },
    });

    const existingSet = new Set(
      existingPairs.map(e => `${e.acordaoNumero}-${e.acordaoAno}`)
    );

    const newItems = relevant.filter(item => {
      const num = parseInt(item.numeroAcordao || '0');
      const ano = parseInt(item.anoAcordao || '0');
      return num > 0 && ano > 0 && !existingSet.has(`${num}-${ano}`);
    });

    console.log(`[Sync TCU] ${newItems.length} acórdãos novos a importar`);

    // 5. Importar novos acórdãos
    let imported = 0;
    let errors = 0;
    const newDocIds: string[] = [];

    for (const item of newItems) {
      try {
        const num = parseInt(item.numeroAcordao || '0');
        const ano = parseInt(item.anoAcordao || '0');
        const titulo = item.titulo || '';
        const sumario = item.sumario || '';
        const colegiado = item.colegiado || '';

        // Gerar título no formato padrão
        const title = `Acórdão TCU ${num}/${ano} - ${colegiado}`;

        // Construir URL
        const docUrl = construirUrlTCU(num, ano, colegiado);

        // Sugerir cursos
        const courses = suggestCoursesTCU(titulo, sumario);
        const mainCourse = courses[0] || '2';
        const isCommon = courses.length > 1;

        // Tags baseadas no colegiado e ano
        const tags = ['TCU', 'Acórdão', colegiado, `${ano}`].filter(Boolean);

        // Parsear data do julgamento
        const dataJulgamento = parseDateTCU(item.dataSessao);

        const created = await prisma.document.create({
          data: {
            title,
            description: sumario || titulo || '',
            url: docUrl,
            type: 'link',
            category: 'acordao',
            courseId: isCommon ? null : mainCourse,
            isCommon,
            isPublic: true,
            reviewed: true,
            reviewedAt: new Date(),
            reviewedBy: 'auto-sync-tcu',
            tags: JSON.stringify(tags),
            acordaoNumero: num,
            acordaoAno: ano,
            tcuNumeroAcordao: `${num}/${ano}`,
            tcuEmentaCompleta: sumario || null,
            tcuRelator: item.relator || null,
            tcuOrgaoJulgador: colegiado || null,
            tcuLinkPDF: item.urlArquivoPDF || item.urlArquivo || null,
            tcuDataJulgamento: dataJulgamento,
            tcuEnriquecidoEm: new Date(),
            tcuEnriquecimentoStatus: 'success',
            embeddingStatus: 'pending', // Será indexado pelo cron de index-jobs
          },
        });

        newDocIds.push(created.id);
        imported++;
      } catch (err) {
        errors++;
        console.error(`[Sync TCU] Erro ao importar ${item.numeroAcordao}/${item.anoAcordao}:`,
          err instanceof Error ? err.message : err);
      }
    }

    // 6. Enriquecer novos acórdãos (resumo Gemini + indexação Lei 14.133)
    const enrichment = await enrichNewDocuments(newDocIds);

    // 7. Identificar acórdãos com potencial editorial
    let highlightCount = 0;
    if (newDocIds.length > 0) {
      try {
        highlightCount = await identifyAndAlertHighlights(newDocIds);
      } catch (err) {
        console.error('[Sync TCU] Erro na fase de highlights:', err);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const result = {
      success: true,
      apiTotal: apiData.length,
      relevant: relevant.length,
      alreadyExists: relevant.length - newItems.length,
      newFound: newItems.length,
      imported,
      errors,
      enrichment,
      highlights: highlightCount,
      elapsed: `${elapsed}s`,
    };

    console.log('[Sync TCU] Resultado:', result);

    return NextResponse.json({
      success: true,
      message: `Sincronização TCU: ${imported} importados, ${enrichment.summaries} resumos, ${enrichment.leiIndexed} Lei-indexed`,
      ...result,
    });

  } catch (error) {
    console.error('[Sync TCU] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar acórdãos do TCU',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
