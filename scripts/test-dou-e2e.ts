/**
 * Script de Teste E2E do Sistema DOU
 *
 * Testa o fluxo completo sem gravar no banco:
 * 1. API DOU (busca real)
 * 2. Classificação (DOUClassifier)
 * 3. Filtro normativo (isAtoNormativoGeral)
 * 4. Detector de alterações (detectModifications)
 * 5. Scraper cheerio (enriquecimento de conteúdo)
 *
 * Uso: npx tsx scripts/test-dou-e2e.ts
 * Opções:
 *   --term "busca"     Termo de busca (padrão: licitação)
 *   --limit N          Máximo de resultados (padrão: 10)
 *   --scrape           Testar scraper nas primeiras 3 URLs
 */

import { searchLastWeek, DOUSection } from '../lib/dou-api';
import { DOUClassifier, DOUDocumentCategory, ApprovalStatus } from '../lib/dou-classifier';
import { isAtoNormativoGeral, shouldAutoApprove, detectAtoType, isProcurementRelated } from '../lib/dou-normative-filter';
import { detectModifications } from '../lib/dou-change-detector';
import { scrapeURL } from '../lib/dou-scraper';

// --- Parse args ---
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}
const searchTerm = getArg('term', 'licitação OR pregão OR contratação');
const maxResults = parseInt(getArg('limit', '10'), 10);
const testScrape = args.includes('--scrape');

// --- Helpers ---
function divider(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function pad(str: string, len: number): string {
  return str.length > len ? str.substring(0, len - 3) + '...' : str.padEnd(len);
}

// --- Main ---
async function main() {
  console.log('DOU E2E Test Script');
  console.log(`Termo: "${searchTerm}"`);
  console.log(`Limite: ${maxResults}`);
  console.log(`Scraper: ${testScrape ? 'SIM' : 'NAO (use --scrape para ativar)'}`);

  // ========================================
  // ETAPA 1: Buscar API DOU
  // ========================================
  divider('ETAPA 1: Busca na API DOU (in.gov.br)');

  let results;
  try {
    results = await searchLastWeek(searchTerm, [DOUSection.TODOS], maxResults);
    console.log(`\nResultados encontrados: ${results.length}`);

    if (results.length === 0) {
      console.log('\nNenhum resultado encontrado. Possibilidades:');
      console.log('  - API do DOU pode estar fora do ar');
      console.log('  - Termo de busca pode estar incorreto');
      console.log('  - Período pode não ter publicações relevantes');
      process.exit(0);
    }

    // Amostra dos primeiros resultados
    console.log('\nPrimeiros resultados:');
    for (const r of results.slice(0, 5)) {
      const cleanTitle = r.title.replace(/<[^>]*>/g, '').trim();
      console.log(`  [${r.section}] ${r.date} - ${cleanTitle.substring(0, 80)}`);
      console.log(`    Hierarquia: ${r.hierarchyStr.substring(0, 60)}`);
      console.log(`    URL: ${r.href.substring(0, 80)}`);
    }
  } catch (error) {
    console.error('\nERRO na busca DOU:', error);
    console.log('\nDiagnostico:');
    console.log('  - Verifique sua conexao com a internet');
    console.log('  - A API https://www.in.gov.br/consulta/-/buscar/dou pode estar fora do ar');
    console.log('  - Tente acessar a URL no navegador');
    process.exit(1);
  }

  // ========================================
  // ETAPA 2: Classificacao
  // ========================================
  divider('ETAPA 2: Classificacao com DOUClassifier');

  const classifications = DOUClassifier.classifyBatch(results);
  const stats = DOUClassifier.getStats(classifications);

  console.log(`\nResumo da classificacao:`);
  console.log(`  Total:          ${stats.total}`);
  console.log(`  Auto-aprovados: ${stats.autoApproved}`);
  console.log(`  Pendentes:      ${stats.pending}`);
  console.log(`  Auto-rejeitados: ${stats.autoRejected}`);

  console.log(`\nPor categoria:`);
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    console.log(`  ${pad(cat, 20)} ${count}`);
  }

  // Detalhes de cada classificacao
  console.log(`\nDetalhes:`);
  for (const [result, classification] of classifications.entries()) {
    const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();
    const statusIcon =
      classification.status === ApprovalStatus.AUTO_APPROVED ? 'V' :
      classification.status === ApprovalStatus.PENDING ? '?' :
      'X';
    console.log(`  [${statusIcon}] ${pad(classification.category, 18)} (${classification.confidence}%) ${cleanTitle.substring(0, 60)}`);
  }

  // ========================================
  // ETAPA 3: Filtro Normativo
  // ========================================
  divider('ETAPA 3: Filtro Normativo (geral vs concreto)');

  let gerais = 0, concretos = 0, ambiguos = 0;
  let procurementRelated = 0;
  const normativeResults: Array<{
    title: string;
    normType: string;
    atoType: string | null;
    autoApprove: boolean;
    procurement: boolean;
  }> = [];

  for (const [result, classification] of classifications.entries()) {
    // Apenas processar categorias relevantes
    if (![DOUDocumentCategory.ATO_NORMATIVO, DOUDocumentCategory.FONTE_AGU, DOUDocumentCategory.SUMULA].includes(classification.category)) {
      continue;
    }

    const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();
    const normType = isAtoNormativoGeral(cleanTitle, result.abstract);
    const atoType = detectAtoType(cleanTitle);
    const autoApprove = normType === 'geral' && shouldAutoApprove(cleanTitle, result.hierarchyStr, atoType);
    const procurement = isProcurementRelated(cleanTitle);

    if (normType === 'geral') gerais++;
    else if (normType === 'concreto') concretos++;
    else ambiguos++;

    if (procurement) procurementRelated++;

    normativeResults.push({
      title: cleanTitle.substring(0, 70),
      normType,
      atoType,
      autoApprove,
      procurement,
    });
  }

  console.log(`\nAtos classificados como relevantes pelo DOUClassifier: ${normativeResults.length}`);
  console.log(`  Gerais:    ${gerais}`);
  console.log(`  Concretos: ${concretos} (serao filtrados)`);
  console.log(`  Ambiguos:  ${ambiguos}`);
  console.log(`  Relacionados a licitacoes (titulo): ${procurementRelated}`);

  if (normativeResults.length > 0) {
    console.log(`\nDetalhes dos atos normativos:`);
    for (const r of normativeResults) {
      const icons = [
        r.normType === 'geral' ? 'GERAL' : r.normType === 'concreto' ? 'CONCRETO' : 'AMBIGUO',
        r.atoType || 'n/a',
        r.autoApprove ? 'AUTO' : 'MANUAL',
        r.procurement ? 'LICIT' : '',
      ].filter(Boolean).join(' | ');
      console.log(`  [${icons}] ${r.title}`);
    }
  }

  // ========================================
  // ETAPA 4: Detector de Alteracoes
  // ========================================
  divider('ETAPA 4: Detector de Alteracoes na Lei 14.133');

  let alteracoesDetectadas = 0;

  for (const result of results) {
    const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();
    const modification = detectModifications(cleanTitle, result.abstract);

    if (modification) {
      alteracoesDetectadas++;
      console.log(`\n  Ato: ${cleanTitle.substring(0, 80)}`);
      console.log(`    Tipo: ${modification.changeType} (confianca: ${modification.confidence}%)`);

      if (modification.modifiesLei14133) {
        console.log(`    Modifica Lei 14.133: SIM`);
        if (modification.affectedArticles.length > 0) {
          console.log(`    Artigos afetados: ${modification.affectedArticles.join(', ')}`);
        }
      }

      if (modification.modifiesExistingAct && modification.existingActRef) {
        const ref = modification.existingActRef;
        console.log(`    Modifica ato existente: ${ref.type} ${ref.number}${ref.year ? `/${ref.year}` : ''}`);
      }
    }
  }

  console.log(`\nTotal de alteracoes detectadas: ${alteracoesDetectadas}`);

  // ========================================
  // ETAPA 5: Scraper (opcional)
  // ========================================
  if (testScrape) {
    divider('ETAPA 5: Teste do Scraper Cheerio');

    const urlsToScrape = results.slice(0, 3).map(r => r.href).filter(u => u);
    console.log(`\nTestando scraper em ${urlsToScrape.length} URLs...`);

    for (const url of urlsToScrape) {
      console.log(`\n  URL: ${url.substring(0, 80)}...`);
      try {
        const content = await scrapeURL(url);
        if (content) {
          console.log(`    Orgao: ${content.orgao}`);
          console.log(`    Edicao: ${content.edicao || 'n/a'}, Secao: ${content.secao || 'n/a'}, Pagina: ${content.pagina || 'n/a'}`);
          console.log(`    Conteudo: ${content.caracteres} caracteres, ${content.paragrafos} paragrafos`);
          console.log(`    Preview: ${content.conteudo.substring(0, 150)}...`);
        } else {
          console.log(`    Resultado: null (estrutura nao encontrada)`);
        }
      } catch (error) {
        console.error(`    ERRO: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // ========================================
  // RESUMO FINAL
  // ========================================
  divider('RESUMO FINAL');

  const autoApprovedDocs = Array.from(classifications.values()).filter(
    c => c.status === ApprovalStatus.AUTO_APPROVED
  ).length;
  const pendingDocs = Array.from(classifications.values()).filter(
    c => c.status === ApprovalStatus.PENDING
  ).length;

  console.log(`
  API DOU:           ${results.length} resultados encontrados
  Classificacao:     ${autoApprovedDocs} auto-aprovados, ${pendingDocs} pendentes, ${stats.autoRejected} rejeitados
  Filtro normativo:  ${gerais} gerais, ${concretos} concretos, ${ambiguos} ambiguos
  Licitacoes:        ${procurementRelated} com keywords no titulo
  Alteracoes:        ${alteracoesDetectadas} detectadas
  `);

  console.log('Teste E2E concluido com sucesso!');
}

main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
