import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeRelevanceTCU, suggestCoursesTCU } from '@/lib/tcu-module';

/**
 * Cron Job: Sincronização automática de acórdãos do TCU
 *
 * Busca os 500 acórdãos mais recentes da API de dados abertos do TCU,
 * filtra os relevantes para licitações/contratos, e importa apenas os novos.
 *
 * Estratégia:
 * - A API retorna os acórdãos mais recentes primeiro (página 0 = mais recentes)
 * - Filtra por relevância usando o módulo tcu-module (keywords de licitações/contratos)
 * - Deduplica pelo par (acordaoNumero, acordaoAno) no banco
 * - Importa com campos TCU preenchidos (ementa, relator, colegiado, etc.)
 * - Marca embeddings como 'pending' para indexação automática pelo cron de index-jobs
 *
 * Segurança: Requer CRON_SECRET ou Authorization header
 * Agendamento: Diário às 6h (vercel.json)
 */

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

export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança
    const cronSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');

    if (cronSecret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }

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
        const mainCourse = courses[0] || '1';
        const isCommon = courses.length > 1;

        // Tags baseadas no colegiado e ano
        const tags = ['TCU', 'Acórdão', colegiado, `${ano}`].filter(Boolean);

        // Parsear data do julgamento
        const dataJulgamento = parseDateTCU(item.dataSessao);

        await prisma.document.create({
          data: {
            title,
            description: sumario || titulo || '',
            url: docUrl,
            type: 'link',
            category: 'acordao',
            courseId: isCommon ? null : mainCourse,
            isCommon,
            isPublic: false,
            reviewed: false,
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

        imported++;
      } catch (err) {
        errors++;
        console.error(`[Sync TCU] Erro ao importar ${item.numeroAcordao}/${item.anoAcordao}:`,
          err instanceof Error ? err.message : err);
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
      elapsed: `${elapsed}s`,
    };

    console.log('[Sync TCU] Resultado:', result);

    return NextResponse.json({
      success: true,
      message: `Sincronização TCU: ${imported} novos acórdãos importados`,
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
