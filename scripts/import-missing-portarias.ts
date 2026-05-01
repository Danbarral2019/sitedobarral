/**
 * Importa Portarias faltantes do gov.br/compras (Portarias Vigentes).
 *
 * Pipeline: scrape → normalize → validate → cria registro → reindex.
 *
 * Aplica `normalizeIssuer` na inferência feita pela URL slug. Se aparecer
 * issuer novo não-canônico, o script lança erro e PARA — exigindo decisão
 * manual antes de criar issuer fora da lista canônica.
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer, type CanonicalIssuer } from '../lib/legislative-acts/issuers';

interface PortariaToImport {
  number: string;
  year: number;
  url: string;
  themeShort: string;
  /** Subtipo: 'normativa', 'conjunta', 'interministerial' ou undefined */
  subtype?: 'normativa' | 'conjunta' | 'interministerial';
}

/**
 * Lista filtrada (35 portarias = Bloco A + B + C + MF):
 * - A: Diretamente Lei 14.133 / contratações (15)
 * - B: Sistemas e ferramentas operacionais (15)
 * - C: Cartão de Pagamento Federal/CPGF (4)
 * - MF: Portaria Normativa MF — Ministério da Fazenda (1)
 *
 * Bloco D (protocolo, energia/água, bilhetes — administração geral) ficou
 * de fora por escolha editorial — não-relacionados a licitações/contratos.
 */
const PORTARIAS: PortariaToImport[] = [
  // ── BLOCO A — Lei 14.133 / contratações (15) ──
  { number: '9.598', year: 2024, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-9-598-de-17-de-dezembro-de-2024', themeShort: 'Altera regime de transição da Lei 14.133/2021' },
  { number: '7.911', year: 2023, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-7-911-de-30-de-novembro-de-2023', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '6.238', year: 2023, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-6-238-de-11-de-outubro-de-2023', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '4.111', year: 2023, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-4-111-de-28-de-julho-de-2023', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '8.389', year: 2021, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-8-389-de-12-de-julho-de-2021', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '4.544', year: 2021, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-4-544-de-5-de-maio-de-2021', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '9.097', year: 2022, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-9-097-de-3-de-novembro-de-2022', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '23.888', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-23888-de-20-de-novembro-de-2020', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '21.262', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-21-262-de-23-de-setembro-de-2020', themeShort: 'Planilha de custos em contratações com dedicação exclusiva' },
  { number: '12.395', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-12-395-de-15-de-maio-de-2020', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '17.405', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-17-405-de-20-de-julho-de-2020', themeShort: 'Altera Anexo Portaria 252/2017' },
  { number: '443', year: 2018, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-443-de-27-de-dezembro-de-2018', themeShort: 'Serviços de execução indireta' },
  { number: '165', year: 2018, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-165-de-18-de-junho-de-2018', themeShort: 'Rede Nacional de Compras Públicas' },
  { number: '252', year: 2017, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-252-de-02-de-agosto-de-2017', themeShort: 'Catálogo de itens (atualizada)' },
  { number: '194', year: 2017, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-194-de-26-de-junho-de-2017', themeShort: 'SIASG para contratação plurianual' },

  // ── BLOCO B — Sistemas e ferramentas operacionais (15) ──
  { number: '1.363', year: 2025, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-1-363-de-21-de-fevereiro-de-2025', themeShort: 'Tramita GOV.BR' },
  { number: '15.496', year: 2021, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-me-no-15-496-de-29-de-dezembro-de-2021-atualizada', themeShort: 'Redirecionamento para Portal PNCP' },
  { number: '10.988', year: 2022, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-me-no-10-988-de-23-de-dezembro-de-2022', themeShort: 'Canal Protocolo.GOV.BR' },
  { number: '4.378', year: 2022, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-me-no-4-378-de-11-de-maio-de-2022', themeShort: 'Altera Portaria 232/2020 (Sistema Siads)' },
  { number: '232', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-232-de-2-de-junho-de-2020', themeShort: 'Sistema Integrado de Gestão Patrimonial - Siads' },
  { number: '355', year: 2019, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-355-de-09-de-agosto-de-2019', themeShort: 'Sistema de Gestão de Acesso – SGA — SIASG' },
  { number: '295', year: 2018, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-295-de-26-de-setembro-de-2018', themeShort: 'Exclusividade Central de Compras (materiais)' },
  { number: '6', year: 2018, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-6-de-15-de-janeiro-de-2018', themeShort: 'Exclusividade Central de Compras (transporte)' },
  { number: '306', year: 2001, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-306-de-13-de-dezembro-de-2001', themeShort: 'Sistema de Cotação Eletrônica' },
  { number: '13.623', year: 2019, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-13-623-de-10-de-dezembro-de-2019', themeShort: 'Redimensionamento de Unidades Administrativas de Serviços Gerais' },
  { number: '80', year: 2016, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-80-de-25-de-abril-de-2016', themeShort: 'Revoga portarias anteriores de 2002 e 2009' },
  { number: '372', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-372-de-6-de-novembro-de-2020', themeShort: 'Revoga Portarias do extinto Min. Planejamento' },
  { number: '22.455', year: 2020, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-no-22-455-de-16-de-outubro-de-2020', themeShort: 'Revoga Portaria 31/2012 conforme Decreto 10.139/2019' },
  { number: '2', year: 2018, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-normativa-no-2-de-30-de-janeiro-de-2018', themeShort: 'Afasta IN 2 para projeto piloto', subtype: 'normativa' },
  { number: '406', year: 2019, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-406-de-23-de-agosto-de-2019', themeShort: 'Declara revogação de portarias normativas' },

  // ── BLOCO C — Cartão de Pagamento Federal/CPGF (4) ──
  { number: '1', year: 2006, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-1-de-4-de-janeiro-de-2006', themeShort: 'Altera Portaria 41/2005 (CPGF)' },
  { number: '41', year: 2005, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-41-de-4-de-marco-de-2005', themeShort: 'Normas para utilização do CPGF' },
  { number: '44', year: 2006, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-44-de-14-de-marco-de-2006', themeShort: 'Altera Portaria 41 (CPGF)' },
  { number: '90', year: 2009, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-no-90-de-24-de-abril-de-2009', themeShort: 'Sistema do Cartão de Pagamento - SCP' },

  // ── MF — Ministério da Fazenda (1) ──
  { number: '1.344', year: 2023, url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-normativa-mf-no-1-344-de-31-de-outubro-de-2023', themeShort: 'Limites financeiros para suprimento de fundos', subtype: 'normativa' },
];

const MONTH_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/**
 * Inferência de issuer canônico pra portarias com base na URL slug.
 * Lança erro se cair em padrão não-mapeado.
 */
function inferIssuerFromUrl(url: string, subtype?: string): CanonicalIssuer {
  const slug = url.toLowerCase();
  // Variações de SEGES (atual MGI/antes ME)
  if (/seges-(mgi|me|no)-/.test(slug)) return normalizeIssuer('SEGES');
  // Ministério da Gestão (sem "seges-") — hoje SEGES institucional
  if (/portaria-mgi-/.test(slug)) return normalizeIssuer('SEGES');
  // Portaria ME genérica — MF entre 2018-22, SEGES era a sub-secretaria emissora real
  if (/portaria-me-/.test(slug)) return normalizeIssuer('SEGES');
  // Portaria Normativa MF — Ministério da Fazenda (canônico próprio)
  if (/portaria-normativa-mf-/.test(slug) || /-mf-no-/.test(slug)) return normalizeIssuer('MF');
  // Portarias Interministeriais — tradicionalmente Min. Planejamento (MPOG)
  if (subtype === 'interministerial' || /portaria-interministerial/.test(slug)) {
    return normalizeIssuer('MPOG');
  }
  // Portarias Conjuntas entre órgãos do SISG — MPOG histórico
  if (subtype === 'conjunta' || /portaria-conjunta/.test(slug)) {
    return normalizeIssuer('MPOG');
  }
  // Portaria Normativa sem prefix issuer
  if (subtype === 'normativa' || /portaria-normativa/.test(slug)) {
    return normalizeIssuer('MPOG');
  }
  // Default: MPOG (atos antigos do extinto Min. Planejamento)
  return normalizeIssuer('MP');
}

function buildFullNumber(issuer: CanonicalIssuer, number: string, year: number, subtype?: string): string {
  const prefix = subtype === 'interministerial' ? 'Portaria Interministerial' : subtype === 'conjunta' ? 'Portaria Conjunta' : subtype === 'normativa' ? 'Portaria Normativa' : 'Portaria';
  return `${prefix} ${issuer} ${number}/${year}`;
}

function extractPublishDate(content: string, fallbackYear: number): Date | null {
  const m = content.slice(0, 1500).match(/Nº\s*[\d\.]+,?\s*DE\s+(\d{1,2})\s*[ºo°]?\s+DE\s+(\w+)\s+DE\s+(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthRaw = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const month = MONTH_PT[monthRaw];
  const year = parseInt(m[3], 10);
  if (!month || year !== fallbackYear) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function extractTitle(content: string, fallbackNumber: string, fallbackYear: number): string {
  const m = content.slice(0, 1500).match(/(PORTARIA(?:\s+(?:CONJUNTA|INTERMINISTERIAL|NORMATIVA))?(?:\s+[A-Z\/-]+)?\s+(?:N[º°o.]?\s*)?[\d\.]+,?\s*DE\s+\d{1,2}\s*[ºo°]?\s+DE\s+\w+\s+DE\s+\d{4}\.?)/i);
  if (m) return m[1].trim().replace(/\s{2,}/g, ' ');
  return `Portaria nº ${fallbackNumber}, de ${fallbackYear}`;
}

const SKIP_EMENTA = [
  /^Presid[êe]ncia/i, /^Casa Civil/i, /^Secretaria/i, /^Subchefia/i,
  /^PORTARIA/i, /^Vig[êe]ncia\s*$/i, /^Texto para impress[ãa]o/i,
  /^\(?Revogad[oa]/i, /^\(?Vide /i, /^Produção de efeito/i, /^Texto compilado/i,
];

function extractEmenta(content: string): string {
  const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphs) {
    if (/^(O\s+SECRETÁRIO|A\s+SECRETÁRIA|O\s+MINISTRO|A\s+MINISTRA|OS\s+MINISTROS)/i.test(p)) break;
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
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : PORTARIAS.length;
  const skipReindex = process.argv.includes('--skip-reindex');
  const subset = PORTARIAS.slice(0, limit);

  console.log(`📋 Importando ${subset.length} portarias`);
  console.log(`   Modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}${skipReindex ? ' --skip-reindex' : ''}\n`);

  const stats: Stats = { scrapeOk: 0, scrapeFail: 0, validateFail: 0, alreadyExists: 0, created: 0, reindexed: 0 };
  const failures: { fullNumber: string; reason: string }[] = [];

  for (const p of subset) {
    let issuer: CanonicalIssuer;
    try {
      issuer = inferIssuerFromUrl(p.url, p.subtype);
    } catch (e) {
      failures.push({ fullNumber: `Portaria ${p.number}/${p.year}`, reason: `issuer: ${(e as Error).message}` });
      continue;
    }
    const fullNumber = buildFullNumber(issuer, p.number, p.year, p.subtype);
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔄 ${fullNumber} — ${p.themeShort.slice(0, 60)}`);

    const existing = await prisma.legislativeAct.findFirst({
      where: { type: 'portaria', number: p.number, year: p.year },
    });
    if (existing) {
      console.log(`   ⏭️  Já existe: ${existing.fullNumber}`);
      stats.alreadyExists++;
      continue;
    }

    console.log(`   🌐 Scraping ${p.url}`);
    const result = await scrapeUrl(p.url);
    if (!result.success || !result.content) {
      console.log(`   ❌ Scrape falhou: ${result.error}`);
      stats.scrapeFail++;
      failures.push({ fullNumber, reason: `scrape: ${result.error ?? 'sem conteúdo'}` });
      continue;
    }
    stats.scrapeOk++;
    console.log(`   ✅ ${result.content.length} chars`);

    const validation = validateActContent({ url: p.url, content: result.content });
    if (validation.errors.length > 0) {
      console.log(`   🚫 Validação falhou:`);
      for (const e of validation.errors) console.log(`      ${e}`);
      stats.validateFail++;
      failures.push({ fullNumber, reason: `validate: ${validation.errors.join('; ')}` });
      continue;
    }
    if (validation.warnings.length > 0) {
      for (const w of validation.warnings) console.log(`   ⚠️  ${w.slice(0, 100)}`);
    }

    const publishDate = extractPublishDate(result.content, p.year) ?? new Date(Date.UTC(p.year, 0, 1));
    const title = extractTitle(result.content, p.number, p.year);
    const ementa = extractEmenta(result.content) || p.themeShort;
    console.log(`   📛 ${title.slice(0, 80)}`);
    console.log(`   📝 ${ementa.slice(0, 100)}...`);

    if (!apply) {
      console.log(`   🔒 dry-run`);
      continue;
    }

    const created = await prisma.legislativeAct.create({
      data: {
        type: 'portaria',
        number: p.number,
        year: p.year,
        fullNumber,
        title,
        ementa,
        issuer,
        publishDate,
        hierarchyLevel: 3,
        officialUrl: p.url,
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
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`   Total processadas: ${subset.length}`);
  console.log(`   ✅ Scrape OK:       ${stats.scrapeOk}`);
  console.log(`   ❌ Scrape falhou:   ${stats.scrapeFail}`);
  console.log(`   🚫 Validate falhou: ${stats.validateFail}`);
  console.log(`   ⏭️  Já existiam:    ${stats.alreadyExists}`);
  console.log(`   ✨ Criadas:         ${stats.created}`);
  console.log(`   🧠 Reindexadas:     ${stats.reindexed}`);
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
