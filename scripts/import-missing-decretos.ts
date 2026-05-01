/**
 * Importa decretos faltantes do gov.br/compras lista oficial (Decretos Vigentes).
 *
 * Pipeline: scrape → normalize → validate → extrai title/ementa/publishDate
 * → cria registro → reindex embeddings.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-decretos.ts                # dry-run de todos
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-decretos.ts --apply --limit=5
 *   npx dotenv -e .env.local -- npx tsx scripts/import-missing-decretos.ts --apply
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer } from '../lib/legislative-acts/issuers';

interface DecretoToImport {
  number: string;
  year: number;
  url: string;
  /** Tema curto pra fallback caso extração falhe */
  themeShort: string;
}

// ── 26 decretos faltantes (alta + média + baixa prioridade) ──────────────
const DECRETOS: DecretoToImport[] = [
  // ── PRIORIDADE ALTA ──
  { number: '7.892', year: 2013, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7892.htm', themeShort: 'Sistema de Registro de Preços (Lei 8.666 — histórico)' },
  { number: '7.581', year: 2011, url: 'http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/Decreto/D7581.htm', themeShort: 'Regulamenta o Regime Diferenciado de Contratações Públicas - RDC (Lei 12.462)' },
  { number: '7.746', year: 2012, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2012/Decreto/D7746.htm', themeShort: 'Sustentabilidade em contratações (art. 3º Lei 8.666)' },
  { number: '9.412', year: 2018, url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9412.htm', themeShort: 'Atualiza valores das modalidades da Lei 8.666' },
  { number: '9.507', year: 2018, url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9507.htm', themeShort: 'Execução indireta de serviços da administração federal' },
  { number: '7.983', year: 2013, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7983.htm', themeShort: 'Orçamento de referência de obras e serviços de engenharia' },
  // ── PRIORIDADE MÉDIA ──
  { number: '7.404', year: 2010, url: 'http://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/Decreto/D7404.htm', themeShort: 'Política Nacional de Resíduos Sólidos (Lei 12.305)' },
  { number: '8.241', year: 2014, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2014/Decreto/D8241.htm', themeShort: 'Fundações de apoio (art. 3º Lei 8.958)' },
  { number: '8.539', year: 2015, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2015/Decreto/D8539.htm', themeShort: 'Uso do meio eletrônico em processo administrativo' },
  { number: '9.046', year: 2017, url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/D9046.htm', themeShort: 'Contratação plurianual de obras, bens e serviços' },
  { number: '9.764', year: 2019, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2019/Decreto/D9764.htm', themeShort: 'Recebimento de doações de bens móveis e serviços' },
  { number: '10.314', year: 2020, url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/D10314.htm', themeShort: 'Altera Decreto 9.764 (recebimento de doações)' },
  { number: '10.667', year: 2021, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2021/Decreto/D10667.htm', themeShort: 'Altera Decreto 9.764 (recebimento de doações)' },
  { number: '11.476', year: 2023, url: 'http://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11476.htm', themeShort: 'Programa de Aquisição de Alimentos (MP 1.166)' },
  // ── PRIORIDADE BAIXA ──
  { number: '8.535', year: 2015, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2015/Decreto/D8535.htm', themeShort: 'Contratação de instituições financeiras pelo Executivo federal' },
  { number: '9.287', year: 2018, url: 'http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/D9287.htm', themeShort: 'Utilização de veículos oficiais' },
  { number: '10.273', year: 2020, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10273.htm', themeShort: 'Altera Decreto 8.538 (margem ME/EPP, Lei 11.488)' },
  { number: '10.278', year: 2020, url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/D10278.htm', themeShort: 'Digitalização de documentos públicos (Lei 13.874)' },
  { number: '10.309', year: 2020, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10309.htm', themeShort: 'Altera Decreto 9.287 (veículos oficiais)' },
  { number: '10.340', year: 2020, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10340.htm', themeShort: 'Altera Decreto 9.373 (alienação de bens móveis)' },
  { number: '10.426', year: 2020, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Decreto/D10426.htm', themeShort: 'Descentralização de créditos entre órgãos federais' },
  { number: '10.554', year: 2020, url: 'http://www.planalto.gov.br/CCIVIL_03/_Ato2019-2022/2020/Decreto/D10554.htm', themeShort: 'Declara revogação de decretos normativos' },
  { number: '10.132', year: 2019, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2019/Decreto/D10132.htm', themeShort: 'Altera Decreto 7.983 (orçamento de referência de obras)' },
  { number: '10.183', year: 2019, url: 'http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/D10183.htm', themeShort: 'Altera Decreto 9.507 (execução indireta de serviços)' },
  { number: '9.488', year: 2018, url: 'http://www.planalto.gov.br/ccivil_03/_Ato2015-2018/2018/Decreto/D9488.htm', themeShort: 'Altera Decreto 7.892 (Sistema de Registro de Preços)' },
  { number: '1.094', year: 1994, url: 'http://www.planalto.gov.br/ccivil_03/decreto/Antigos/D1094.htm', themeShort: 'Sistema de Serviços Gerais (SISG)' },
];

const MONTH_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** Extrai publishDate do título "DECRETO Nº X, DE D DE MES DE YYYY". */
function extractPublishDate(content: string, fallbackYear: number): Date | null {
  const m = content
    .slice(0, 1500)
    .match(/Nº\s*[\d\.]+,?\s*DE\s+(\d{1,2})\s*[ºo°]?\s+DE\s+(\w+)\s+DE\s+(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthRaw = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const month = MONTH_PT[monthRaw];
  const year = parseInt(m[3], 10);
  if (!month || year !== fallbackYear) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Extrai title — linha "DECRETO Nº X, DE D DE MES DE YYYY" do início do content. */
function extractTitle(content: string, fallbackNumber: string, fallbackYear: number): string {
  const m = content
    .slice(0, 1500)
    .match(/(DECRETO\s+(?:N[º°o.]?\s*)?[\d\.]+,?\s*DE\s+\d{1,2}\s*[ºo°]?\s+DE\s+\w+\s+DE\s+\d{4}\.?)/i);
  if (m) return m[1].trim().replace(/\s{2,}/g, ' ');
  return `Decreto nº ${fallbackNumber}, de ${fallbackYear}`;
}

/** Padrões que NÃO são ementa (status/revogação/etc). */
const SKIP_EMENTA = [
  /^Presid[êe]ncia/i,
  /^Casa Civil/i,
  /^Secretaria/i,
  /^Subchefia/i,
  /^DECRETO/i,
  /^Vig[êe]ncia\s*$/i,
  /^Texto para impress[ãa]o/i,
  /^\(?Revogad[oa]/i,
  /^\(?Vide /i,
  /^Produção de efeito/i,
  /^Promulgação parcial/i,
  /^Texto compilado/i,
];

/** Extrai ementa — primeiro parágrafo "real" entre o título e o preâmbulo "O PRESIDENTE...". */
function extractEmenta(content: string): string {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of paragraphs) {
    // Termina ao chegar no preâmbulo legal
    if (/^(O\s+PRESIDENTE|A\s+PRESIDENTE)/i.test(p)) break;
    // Pula marcadores irrelevantes
    if (SKIP_EMENTA.some((pat) => pat.test(p))) continue;
    if (p.length > 30 && p.length < 1500) return p;
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
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : DECRETOS.length;
  const skipReindex = process.argv.includes('--skip-reindex');

  const subset = DECRETOS.slice(0, limit);
  console.log(`📋 Importando ${subset.length} decretos`);
  console.log(`   Modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}${skipReindex ? ' --skip-reindex' : ''}\n`);

  const stats: Stats = { scrapeOk: 0, scrapeFail: 0, validateFail: 0, alreadyExists: 0, created: 0, reindexed: 0 };
  const failures: { fullNumber: string; reason: string }[] = [];

  for (const d of subset) {
    const fullNumber = `Decreto ${d.number}/${d.year}`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔄 ${fullNumber} — ${d.themeShort.slice(0, 60)}`);

    const existing = await prisma.legislativeAct.findFirst({
      where: { type: 'decreto', number: d.number, year: d.year },
    });
    if (existing) {
      console.log(`   ⏭️  Já existe: ${existing.fullNumber}`);
      stats.alreadyExists++;
      continue;
    }

    console.log(`   🌐 Scraping ${d.url}`);
    const result = await scrapeUrl(d.url);
    if (!result.success || !result.content) {
      console.log(`   ❌ Scrape falhou: ${result.error}`);
      stats.scrapeFail++;
      failures.push({ fullNumber, reason: `scrape: ${result.error ?? 'sem conteúdo'}` });
      continue;
    }
    stats.scrapeOk++;
    console.log(`   ✅ ${result.content.length} chars`);

    const validation = validateActContent({ url: d.url, content: result.content });
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

    const publishDate = extractPublishDate(result.content, d.year);
    const finalDate = publishDate ?? new Date(Date.UTC(d.year, 0, 1));
    if (!publishDate) console.log(`   ⚠️  publishDate fallback: 1º jan/${d.year}`);
    else console.log(`   📅 ${finalDate.toISOString().slice(0, 10)}`);

    const title = extractTitle(result.content, d.number, d.year);
    const ementa = extractEmenta(result.content) || d.themeShort;
    console.log(`   📛 title: "${title.slice(0, 80)}"`);
    console.log(`   📝 ementa: "${ementa.slice(0, 100)}..."`);

    if (!apply) {
      console.log(`   🔒 dry-run — não escreve.`);
      continue;
    }

    const created = await prisma.legislativeAct.create({
      data: {
        type: 'decreto',
        number: d.number,
        year: d.year,
        fullNumber,
        title,
        ementa,
        issuer: normalizeIssuer('Presidência'),
        publishDate: finalDate,
        hierarchyLevel: 2,
        officialUrl: d.url,
        content: result.content,
        contentHash: result.hash ?? result.contentHash,
        esfera: 'federal',
        embeddingStatus: 'pending',
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });
    stats.created++;
    console.log(`   ✨ Criado: ${created.id}`);

    if (!skipReindex) {
      const reindex = await processLegislativeAct(created.id, { forceReprocess: true });
      if (reindex.success) {
        stats.reindexed++;
        console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks`);
      } else {
        console.log(`   ⚠️  Reindex falhou: ${reindex.error}`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 RESULTADO`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Total processados: ${subset.length}`);
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
