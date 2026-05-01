/**
 * Importa as 42 INs vigentes no índice oficial gov.br/compras que não
 * estão no banco. Pipeline: scrape → normalize → validate → create →
 * reindex embeddings. Usa flags `--apply` (default: dry-run) e
 * `--limit=N` (default: todas).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-ins.ts                    # dry-run de todas
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-ins.ts --apply --limit=5 # importa 5
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-ins.ts --apply           # importa todas
 */
import { prisma } from '../lib/prisma';
import { GovBrComprasScraper } from '../lib/legislative-scrapers/govbr-compras';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer, type CanonicalIssuer } from '../lib/legislative-acts/issuers';

interface OfficialIn {
  number: string;
  year: number;
  title: string;
  url: string;
}

// Lista das 42 INs do oficial não cadastradas no banco (do audit 2026-05-01)
const MISSING_INS: OfficialIn[] = [
  { number: '51', year: 2021, title: 'Estabelece procedimentos para utilização do Almoxarifado Virtual Nacional', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-51-de-13-de-maio-de-2021' },
  { number: '42', year: 2021, title: 'Altera a Instrução Normativa nº 53, sobre operação de crédito com cessão fiduciária', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-42-de-19-de-abril-de-2021' },
  { number: '107', year: 2020, title: 'Altera a Instrução Normativa nº 3, de 26 de abril de 2018, sobre o Sicaf', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-107-de-28-de-outubro-de-2020' },
  { number: '102', year: 2020, title: 'Revoga Instruções Normativas e Orientações Normativas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-no-102-de-16-de-outubro-de-2020' },
  { number: '96', year: 2020, title: 'Altera a Instrução Normativa nº 6, de 12 de agosto de 2019, sobre recebimento de doações', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-96-de-02-de-outubro-de-2020' },
  { number: '76', year: 2020, title: 'Altera o prazo de vigência da Instrução Normativa nº 53, de 8 de julho de 2020', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-76-de-11-de-agosto-de-2020' },
  { number: '73', year: 2020, title: 'Dispõe sobre procedimento administrativo para pesquisa de preços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-73-de-5-de-agosto-de-2020' },
  { number: '64', year: 2020, title: 'Altera o prazo de vigência da Instrução Normativa nº 10, de 10 de fevereiro de 2020', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-64-de-29-de-julho-de-2020' },
  { number: '50', year: 2020, title: 'Altera prazo para atualização de informações da Instrução Normativa nº 13, de 2020', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-50-de-02-de-julho-de-2020' },
  { number: '49', year: 2020, title: 'Altera a Instrução Normativa nº 5, de 26 de maio de 2017, sobre contratação de serviços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-49-de-30-de-junho-de-2020' },
  { number: '40', year: 2020, title: 'Dispõe sobre elaboração de Estudos Técnicos Preliminares e Sistema ETP digital', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-40-de-22-de-maio-de-2020' },
  { number: '16', year: 2020, title: 'Declara a revogação de Instruções Normativas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-16-de-04-de-marco-de-2020' },
  { number: '13', year: 2020, title: 'Dispõe sobre atribuição de código e cadastramento de unidades protocolizadoras', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-13-de-27-de-fevereiro-de-2020-atualizada' },
  { number: '12', year: 2020, title: 'Declara a revogação de Instruções Normativas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-12-de-20-de-fevereiro-de-2020' },
  { number: '10', year: 2020, title: 'Altera a Instrução Normativa nº 3, de 26 de abril de 2018, sobre o Sicaf', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-10-de-10-de-fevereiro-de-2020-atualizada' },
  { number: '210', year: 2019, title: 'Revoga a Instrução Normativa nº 3, de 16 de dezembro de 2011, sobre pregão eletrônico', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-210-de-20-de-novembro-de-2019' },
  { number: '206', year: 2019, title: 'Estabelece prazos para uso obrigatório de pregão eletrônico e dispensa eletrônica', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-206-de-18-de-outubro-de-2019' },
  { number: '6', year: 2019, title: 'Regulamenta o Decreto nº 9.764, sobre recebimento de doações de bens móveis', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-6-de-12-de-agosto-de-2019' },
  { number: '3', year: 2019, title: 'Altera a Instrução Normativa nº 2, sobre Compra Institucional de alimentos', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-27-de-maio-de-2019' },
  { number: '11', year: 2018, title: 'Dispõe sobre ferramenta informatizada de disponibilização de bens móveis inservíveis', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-11-de-29-de-novembro-de-2018' },
  { number: '7', year: 2018, title: 'Altera a Instrução Normativa nº 5, sobre contratação de serviços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-07-de-20-de-setembro-de-2018' },
  { number: '6', year: 2018, title: 'Dispõe sobre cláusulas assecuratórias de direitos trabalhistas em obras públicas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-6-de-6-de-julho-de-2018' },
  { number: '5', year: 2018, title: 'Altera o art. 18 da Instrução Normativa nº 3, de 11 de fevereiro de 2015', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-05-de-julho-de-2018' },
  { number: '4', year: 2018, title: 'Diretrizes e procedimentos para elaboração de atos normativos no MP', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-mp-no-4-de-24-de-julho-de-2018' },
  { number: '3', year: 2018, title: 'Sicaf no âmbito do Poder Executivo Federal', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-26-de-abril-de-2018' },
  { number: '2', year: 2018, title: 'Compra Institucional de alimentos da agricultura familiar', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-2-de-29-de-marco-de-2018' },
  { number: '4', year: 2017, title: 'Ressarcimento de bagagens despachadas em viagens a serviço', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-4-de-11-de-julho-de-2017' },
  { number: '2', year: 2016, title: 'Ordem cronológica de pagamento das obrigações no Sisg', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-2-de-6-de-dezembro-de-2016' },
  { number: '3', year: 2015, title: 'Diretrizes e procedimentos para aquisição de passagens aéreas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-11-de-fevereiro-de-2015' },
  { number: '6', year: 2014, title: 'Remanejamento das quantidades em Atas de Registro de Preços', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-6-de-25-de-julho-de-2014' },
  { number: '2', year: 2014, title: 'Aquisição/locação de máquinas com Etiqueta Nacional de Conservação de Energia (ENCE)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-2-de-04-de-junho-de-2014' },
  { number: '5', year: 2013, title: 'RDC eletrônico (Lei nº 12.462/2011)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-5-de-7-de-novembro-de-2013' },
  { number: '10', year: 2012, title: 'Planos de Gestão de Logística Sustentável', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-10-de-12-de-novembro-de-2012' },
  { number: '9', year: 2012, title: 'Contenção de despesas (Decreto nº 99.188/1990)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-9-de-3-de-outubro-de-2012' },
  { number: '2', year: 2011, title: 'Operacionalização do SIASG (módulos e subsistemas)', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-2-de-16-de-agosto-de-2011' },
  { number: '1', year: 2010, title: 'Critérios de sustentabilidade ambiental em aquisições públicas', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-01-de-19-de-janeiro-de-2010' },
  { number: '3', year: 2008, title: 'Classificação, utilização, identificação, aquisição e alienação de veículos oficiais', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-3-de-15-de-maio-de-2008' },
  { number: '12', year: 1997, title: 'Aquisição, utilização, controle e manutenção de equipamentos de telefonia', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-12-de-05-de-setembro-de-1997' },
  { number: '6', year: 1995, title: 'Reciclagem de papel e outros resíduos', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-06-de-03-de-novembro-de-1995' },
  { number: '205', year: 1988, title: 'Minimização de custos de uso de material no SISG', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-205-de-08-de-abril-de-1988' },
  { number: '183', year: 1986, title: 'Procedimentos em acidentes com veículos terrestres oficiais', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-ndeg-183-de-8-de-setembro-de-1986' },
  { number: '142', year: 1983, title: 'IN nº 142, de 5 de agosto de 1983', url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-n-o-142-de-05-de-agosto-de-1983' },
];

/** Mapa de mês PT-BR pra número */
const MONTH_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/**
 * Extrai issuer canônico da URL slug. Sempre retorna valor canônico
 * de CANONICAL_ISSUERS (lib/legislative-acts/issuers.ts).
 */
function inferIssuerFromUrl(url: string): CanonicalIssuer {
  const slug = url.toLowerCase();
  // Todas as variações de SEGES → "SEGES" (atual MGI/antes ME/AUTOR-ME)
  if (/seges-(mgi|me|no)-/.test(slug)) return normalizeIssuer('SEGES');
  if (/autor-me-/.test(slug)) return normalizeIssuer('AUTOR/ME'); // → SEGES
  if (/-mp-no-/.test(slug)) return normalizeIssuer('MP'); // → MPOG
  // INs antigas sem prefix → MPOG (Ministério do Planejamento histórico)
  return normalizeIssuer('MP');
}

/**
 * Constrói fullNumber. Usa o issuer canônico exatamente como salvo
 * no DB, garantindo consistência com lookups posteriores.
 */
function buildFullNumber(issuer: CanonicalIssuer, number: string, year: number): string {
  return `IN ${issuer} ${number}/${year}`;
}

/** Tenta extrair publishDate do conteúdo "INSTRUÇÃO NORMATIVA ... Nº X, DE D DE MES DE YYYY". */
function extractPublishDate(content: string, fallbackYear: number): Date | null {
  const m = content
    .slice(0, 1000)
    .match(/Nº\s*\d+[A-Z]?,?\s*DE\s+(\d{1,2})\s+DE\s+(\w+)\s+DE\s+(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthRaw = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const month = MONTH_PT[monthRaw];
  const year = parseInt(m[3], 10);
  if (!month || year !== fallbackYear) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Extrai a ementa: primeiro parágrafo após o título e antes do preâmbulo. */
function extractEmenta(content: string): string {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Pula o título (linha 0). Pega próximos parágrafos até encontrar
  // "O SECRETÁRIO/MINISTRO/PRESIDENTE/RESOLVE" (preâmbulo).
  for (let i = 1; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (/^(O\s+SECRETÁRIO|A\s+SECRETÁRIA|O\s+MINISTRO|A\s+MINISTRA|O\s+PRESIDENTE|A\s+PRESIDENTE)/i.test(p)) break;
    if (p.length > 30) return p;
  }
  return '';
}

interface Stats {
  scrapeOk: number;
  scrapeFail: number;
  validateFail: number;
  alreadyExists: number;
  created: number;
  reindexed: number;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : MISSING_INS.length;
  const skipReindex = process.argv.includes('--skip-reindex');

  console.log(`📋 Importando ${Math.min(limit, MISSING_INS.length)} INs do gov.br/compras`);
  console.log(`   Modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}${skipReindex ? ' --skip-reindex' : ''}\n`);

  const scraper = new GovBrComprasScraper();
  const stats: Stats = { scrapeOk: 0, scrapeFail: 0, validateFail: 0, alreadyExists: 0, created: 0, reindexed: 0 };
  const failures: { fullNumber: string; reason: string }[] = [];

  const inSubset = MISSING_INS.slice(0, limit);

  for (const inDef of inSubset) {
    const tag = `${inDef.number}/${inDef.year}`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔄 IN ${tag} — ${inDef.title.slice(0, 70)}`);

    const issuer = inferIssuerFromUrl(inDef.url);
    const fullNumber = buildFullNumber(issuer, inDef.number, inDef.year);
    console.log(`   issuer:     ${issuer}`);
    console.log(`   fullNumber: ${fullNumber}`);

    // Checa se já existe (defensivo — pode ter outro fullNumber)
    const existingByNumYear = await prisma.legislativeAct.findFirst({
      where: { type: 'in', number: inDef.number, year: inDef.year },
    });
    if (existingByNumYear) {
      console.log(`   ⏭️  Já existe: ${existingByNumYear.fullNumber}`);
      stats.alreadyExists++;
      continue;
    }

    // Scrape
    console.log(`   🌐 Scraping ${inDef.url}`);
    const result = await scraper.scrape(inDef.url);
    if (!result.success) {
      console.log(`   ❌ Scrape falhou: ${result.error}`);
      stats.scrapeFail++;
      failures.push({ fullNumber, reason: `scrape: ${result.error}` });
      continue;
    }
    stats.scrapeOk++;
    console.log(`   ✅ ${result.content?.length ?? 0} chars`);

    // Validate
    const validation = validateActContent({ url: inDef.url, content: result.content });
    if (validation.errors.length > 0) {
      console.log(`   🚫 Validação falhou:`);
      for (const e of validation.errors) console.log(`      ${e}`);
      stats.validateFail++;
      failures.push({ fullNumber, reason: `validate: ${validation.errors.join('; ')}` });
      continue;
    }
    if (validation.warnings.length > 0) {
      console.log(`   ⚠️  Warnings:`);
      for (const w of validation.warnings) console.log(`      ${w}`);
    }

    // Extrair publishDate
    const content = result.content!;
    const publishDate = extractPublishDate(content, inDef.year);
    if (!publishDate) {
      console.log(`   ⚠️  publishDate não extraído — usando 1º jan/${inDef.year}`);
    }
    const finalDate = publishDate ?? new Date(Date.UTC(inDef.year, 0, 1));
    console.log(`   📅 publishDate: ${finalDate.toISOString().slice(0, 10)}`);

    // Extrair ementa
    const ementa = extractEmenta(content) || inDef.title;
    console.log(`   📝 ementa: "${ementa.slice(0, 100)}..."`);

    if (!apply) {
      console.log(`   🔒 dry-run — não escreve.`);
      continue;
    }

    // Criar registro
    const created = await prisma.legislativeAct.create({
      data: {
        type: 'in',
        number: inDef.number,
        year: inDef.year,
        fullNumber,
        title: inDef.title,
        ementa,
        issuer, // já canônico de inferIssuerFromUrl()
        publishDate: finalDate,
        hierarchyLevel: 4,
        officialUrl: inDef.url,
        content,
        contentHash: result.contentHash,
        esfera: 'federal',
        embeddingStatus: 'pending',
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });
    stats.created++;
    console.log(`   ✅ Criado id=${created.id}`);

    // Reindex
    if (!skipReindex) {
      const reindex = await processLegislativeAct(created.id, { forceReprocess: true });
      if (!reindex.success) {
        console.log(`   ⚠️  Reindex falhou: ${reindex.error}`);
      } else {
        stats.reindexed++;
        console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 RESULTADO`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Total processadas: ${inSubset.length}`);
  console.log(`   ✅ Scrape OK:       ${stats.scrapeOk}`);
  console.log(`   ❌ Scrape falhou:   ${stats.scrapeFail}`);
  console.log(`   🚫 Validate falhou: ${stats.validateFail}`);
  console.log(`   ⏭️  Já existiam:    ${stats.alreadyExists}`);
  console.log(`   ✨ Criados:         ${stats.created}`);
  console.log(`   🧠 Reindexados:     ${stats.reindexed}`);
  if (failures.length) {
    console.log(`\n⚠️  Falhas:`);
    for (const f of failures) console.log(`   - ${f.fullNumber}: ${f.reason}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
