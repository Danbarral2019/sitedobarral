/**
 * Enriquecimento de acórdãos TCU via API de dados abertos
 *
 * Busca ementa completa, relator, link PDF e outros metadados da API do TCU
 * e atualiza os acórdãos restantes no banco.
 *
 * NOTA: A API do TCU (dados-abertos.apps.tcu.gov.br) ignora os parâmetros anoInicio/anoFim
 * e retorna acórdãos em ordem cronológica decrescente. Por isso paginamos sequencialmente
 * até cobrir os anos necessários (2021-2025).
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/enrich-tcu-from-api.ts --dry-run         # Simular
 *   npx tsx scripts/enrich-tcu-from-api.ts --limit 50        # Testar com poucos
 *   npx tsx scripts/enrich-tcu-from-api.ts                   # Executar todos
 *   npx tsx scripts/enrich-tcu-from-api.ts --force           # Reprocessar todos (inclusive já enriquecidos)
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
const DELAY_MS = 1000; // Delay entre chamadas à API (ms)
const PAGE_SIZE = 500;
const MIN_YEAR = 2021; // Parar de paginar quando atingir acórdãos anteriores a esse ano

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

interface EnrichmentStats {
  total: number;
  enriched: number;
  notFound: number;
  errors: number;
  updatedDescription: number;
}

/**
 * Busca uma página da API de dados abertos do TCU (acessa diretamente sem fetchAcordaosTCU
 * para evitar processamento desnecessário de relevância)
 */
async function fetchTCUPage(inicio: number): Promise<TCUApiItem[]> {
  const url = `https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?inicio=${inicio}&quantidade=${PAGE_SIZE}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       ENRIQUECIMENTO DE ACÓRDÃOS TCU VIA API               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 MODO DRY-RUN: nenhuma alteração será feita\n');
  }

  // 1. Buscar acórdãos pendentes de enriquecimento
  const whereCondition = FORCE
    ? { category: 'acordao' as const }
    : {
        category: 'acordao' as const,
        tcuEnriquecidoEm: null,
      };

  let docs = await prisma.document.findMany({
    where: whereCondition,
    select: {
      id: true,
      title: true,
      description: true,
      acordaoNumero: true,
      acordaoAno: true,
      tcuNumeroAcordao: true,
      tcuEmentaCompleta: true,
      tcuRelator: true,
      tcuLinkPDF: true,
      tcuEnriquecidoEm: true,
    },
    orderBy: [{ acordaoAno: 'desc' }, { acordaoNumero: 'desc' }],
  });

  if (LIMIT > 0) {
    docs = docs.slice(0, LIMIT);
  }

  console.log(`📊 Acórdãos a processar: ${docs.length}${FORCE ? ' (--force: reprocessando todos)' : ''}`);
  if (LIMIT > 0) console.log(`   (limitado a ${LIMIT})`);
  console.log('');

  if (docs.length === 0) {
    console.log('✅ Nenhum acórdão pendente de enriquecimento.');
    return;
  }

  // 2. Construir set de chaves que precisamos encontrar
  const needed = new Set<string>();
  const docsByKey = new Map<string, typeof docs>();
  for (const doc of docs) {
    const key = `${doc.acordaoNumero}-${doc.acordaoAno}`;
    needed.add(key);
    if (!docsByKey.has(key)) docsByKey.set(key, []);
    docsByKey.get(key)!.push(doc);
  }
  console.log(`🎯 Chaves únicas a buscar: ${needed.size}`);

  // 3. Paginar a API do TCU até encontrar todos ou ultrapassar MIN_YEAR
  const apiCache = new Map<string, TCUApiItem>();
  let inicio = 0;
  let totalFetched = 0;
  let found = 0;
  let minYearSeen = 9999;
  let consecutiveEmptyPages = 0;

  console.log(`📡 Paginando API do TCU (min ano: ${MIN_YEAR})...\n`);

  while (true) {
    try {
      const items = await fetchTCUPage(inicio);
      totalFetched += items.length;

      let newFoundInPage = 0;
      for (const item of items) {
        const num = item.numeroAcordao || '';
        const ano = item.anoAcordao || '';
        const key = `${num}-${ano}`;
        const anoInt = parseInt(ano);

        if (anoInt < minYearSeen) minYearSeen = anoInt;

        if (needed.has(key) && !apiCache.has(key)) {
          apiCache.set(key, item);
          found++;
          newFoundInPage++;
        }
      }

      // Progress
      const page = Math.floor(inicio / PAGE_SIZE) + 1;
      if (page <= 10 || page % 20 === 0 || newFoundInPage > 0) {
        console.log(`   Página ${page}: +${items.length} acórdãos (encontrados: ${found}/${needed.size}, ano mín: ${minYearSeen})`);
      }

      // Condições de parada
      if (found >= needed.size) {
        console.log(`\n✅ Todos os ${needed.size} acórdãos encontrados!`);
        break;
      }

      if (minYearSeen < MIN_YEAR) {
        console.log(`\n⏹️  Atingiu ano ${minYearSeen} (< ${MIN_YEAR}). Parando paginação.`);
        break;
      }

      if (items.length < PAGE_SIZE) {
        console.log(`\n⏹️  Fim da API (${items.length} < ${PAGE_SIZE}).`);
        break;
      }

      // Detectar se não estamos encontrando nada (para não ficar em loop)
      if (newFoundInPage === 0) {
        consecutiveEmptyPages++;
      } else {
        consecutiveEmptyPages = 0;
      }

      // Se 100 páginas sem encontrar nada e já passamos do MIN_YEAR
      if (consecutiveEmptyPages > 100 && minYearSeen <= MIN_YEAR + 1) {
        console.log(`\n⏹️  ${consecutiveEmptyPages} páginas sem novos matches. Parando.`);
        break;
      }

      inicio += PAGE_SIZE;
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    } catch (error) {
      console.error(`   ✗ Erro na página ${Math.floor(inicio / PAGE_SIZE) + 1}:`, error instanceof Error ? error.message : error);
      // Tentar continuar após erro
      inicio += PAGE_SIZE;
      await new Promise(resolve => setTimeout(resolve, DELAY_MS * 3));
    }
  }

  console.log(`\n📦 Total buscado na API: ${totalFetched} acórdãos`);
  console.log(`📦 Encontrados: ${found}/${needed.size} (${Math.round(found / needed.size * 100)}%)`);
  console.log('');

  // 4. Enriquecer cada documento
  const stats: EnrichmentStats = {
    total: docs.length,
    enriched: 0,
    notFound: 0,
    errors: 0,
    updatedDescription: 0,
  };

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const progress = `[${i + 1}/${docs.length}]`;
    const key = `${doc.acordaoNumero}-${doc.acordaoAno}`;
    const apiData = apiCache.get(key);

    if (!apiData) {
      stats.notFound++;
      if (stats.notFound <= 10) {
        console.log(`${progress} ⚠ Não encontrado: ${doc.title} (${key})`);
      }
      // Marcar como falha se não for dry-run
      if (!DRY_RUN) {
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            tcuEnriquecidoEm: new Date(),
            tcuEnriquecimentoStatus: 'failed',
            tcuEnriquecimentoErro: 'Acórdão não encontrado na API de dados abertos do TCU',
          },
        });
      }
      continue;
    }

    await enrichDoc(doc, apiData, progress, stats);
  }

  // 5. Resultado
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      RESULTADO                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`   Total processados: ${stats.total}`);
  console.log(`   Enriquecidos: ${stats.enriched}`);
  console.log(`   Não encontrados na API: ${stats.notFound}`);
  console.log(`   Erros: ${stats.errors}`);
  console.log(`   Descrição atualizada: ${stats.updatedDescription}`);
  console.log('');

  if (stats.updatedDescription > 0) {
    console.log(`💡 ${stats.updatedDescription} documentos tiveram a descrição atualizada.`);
    console.log('   Execute "npx tsx scripts/migrate-to-embeddings.ts" para re-indexar os embeddings.');
  }

  if (DRY_RUN) {
    console.log('\n💡 Execute sem --dry-run para aplicar as mudanças.');
  } else {
    console.log('\n✅ Enriquecimento concluído!');
  }
}

async function enrichDoc(
  doc: { id: string; title: string; description: string | null; acordaoNumero: number | null; acordaoAno: number | null },
  apiData: TCUApiItem,
  progress: string,
  stats: EnrichmentStats,
) {
  try {
    const ementaCompleta = apiData.sumario || undefined;
    const relator = apiData.relator || undefined;
    const linkPDF = apiData.urlArquivoPDF || apiData.urlArquivo || undefined;
    const orgaoJulgador = apiData.colegiado || undefined;
    const dataSessao = apiData.dataSessao || undefined;

    // Verificar se a ementa é melhor que a descrição atual
    const currentDesc = doc.description || '';
    const shouldUpdateDescription =
      ementaCompleta &&
      ementaCompleta.length > currentDesc.length * 1.3 &&
      ementaCompleta.length > 100;

    if (DRY_RUN) {
      const changes: string[] = [];
      if (ementaCompleta) changes.push('ementa');
      if (relator) changes.push('relator');
      if (linkPDF) changes.push('linkPDF');
      if (orgaoJulgador) changes.push('órgão');
      if (shouldUpdateDescription) changes.push('descrição↑');

      if (changes.length > 0) {
        stats.enriched++;
        if (shouldUpdateDescription) stats.updatedDescription++;
        if (stats.enriched <= 20 || stats.enriched % 50 === 0) {
          console.log(`${progress} 📝 ${doc.title} → ${changes.join(', ')}`);
        }
      }
      return;
    }

    // Parse data do julgamento
    let tcuDataJulgamento: Date | undefined;
    if (dataSessao) {
      const parts = dataSessao.split('/');
      if (parts.length === 3) {
        const [dia, mes, ano] = parts;
        tcuDataJulgamento = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
        if (isNaN(tcuDataJulgamento.getTime())) tcuDataJulgamento = undefined;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      tcuEmentaCompleta: ementaCompleta || undefined,
      tcuRelator: relator || undefined,
      tcuLinkPDF: linkPDF || undefined,
      tcuOrgaoJulgador: orgaoJulgador || undefined,
      tcuDataJulgamento,
      tcuEnriquecidoEm: new Date(),
      tcuEnriquecimentoStatus: 'success',
    };

    if (shouldUpdateDescription) {
      updateData.description = ementaCompleta;
      updateData.embeddingStatus = 'pending';
      stats.updatedDescription++;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: updateData,
    });

    stats.enriched++;
    if (stats.enriched <= 20 || stats.enriched % 50 === 0) {
      console.log(`${progress} ✓ ${doc.title}${shouldUpdateDescription ? ' (descrição atualizada)' : ''}`);
    }
  } catch (error) {
    stats.errors++;
    console.error(`${progress} ✗ Erro ao enriquecer ${doc.title}:`, error instanceof Error ? error.message : error);
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
