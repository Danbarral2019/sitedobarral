/**
 * Importa as 22 leis essenciais (Tier 1+2+3+4) que ainda faltam no banco.
 *
 * Pipeline: scrapeUrl → fallback fetch direto + cheerio (pra páginas
 * antigas) → validate → save → reindex.
 *
 * Tipos: lei, lei-complementar, decreto-lei.
 * Issuer: sempre 'Presidência da República' (canônico).
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import * as cheerio from 'cheerio';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer } from '../lib/legislative-acts/issuers';

interface LeiEssencial {
  type: 'lei' | 'lei-complementar' | 'decreto-lei';
  number: string;
  year: number;
  apelido: string;
  ementaCurta: string;
  publishDate: string;
  hierarchyLevel: 1 | 2;
  /** URLs em ordem de tentativa */
  urls: string[];
  tier: 1 | 2 | 3 | 4;
}

const LEIS: LeiEssencial[] = [
  // ── TIER 1 — Fundamentais (7) ──
  {
    type: 'lei-complementar', number: '123', year: 2006, tier: 1,
    apelido: 'Estatuto Nacional ME/EPP',
    ementaCurta: 'Institui o Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte; altera leis sobre tributos federais, estabelece tratamento diferenciado em licitações públicas (referenciado no art. 4º da Lei 14.133/2021).',
    publishDate: '2006-12-14',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm'],
  },
  {
    type: 'lei-complementar', number: '147', year: 2014, tier: 1,
    apelido: 'Altera o Estatuto ME/EPP',
    ementaCurta: 'Altera a Lei Complementar nº 123/2006 (Estatuto da Microempresa e Empresa de Pequeno Porte) e dá outras providências, incluindo regras de tratamento diferenciado em licitações.',
    publishDate: '2014-08-07',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp147.htm'],
  },
  {
    type: 'lei', number: '8.987', year: 1995, tier: 1,
    apelido: 'Concessões e permissões de serviços públicos',
    ementaCurta: 'Dispõe sobre o regime de concessão e permissão da prestação de serviços públicos previstos no art. 175 da Constituição Federal.',
    publishDate: '1995-02-13',
    hierarchyLevel: 1,
    urls: [
      'https://www.planalto.gov.br/ccivil_03/leis/l8987compilada.htm',
      'https://www.planalto.gov.br/ccivil_03/leis/l8987.htm',
    ],
  },
  {
    type: 'lei', number: '11.079', year: 2004, tier: 1,
    apelido: 'PPPs — Parcerias Público-Privadas',
    ementaCurta: 'Institui normas gerais para licitação e contratação de parceria público-privada no âmbito da administração pública.',
    publishDate: '2004-12-30',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11079.htm'],
  },
  {
    type: 'lei', number: '13.303', year: 2016, tier: 1,
    apelido: 'Lei das Estatais',
    ementaCurta: 'Dispõe sobre o estatuto jurídico da empresa pública, da sociedade de economia mista e de suas subsidiárias, com regras próprias de licitações e contratos.',
    publishDate: '2016-06-30',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13303.htm'],
  },
  {
    type: 'lei', number: '12.462', year: 2011, tier: 1,
    apelido: 'RDC — Regime Diferenciado de Contratações',
    ementaCurta: 'Institui o Regime Diferenciado de Contratações Públicas — RDC. Referenciada no regime de transição da Lei 14.133/2021.',
    publishDate: '2011-08-05',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12462.htm'],
  },
  {
    type: 'decreto-lei', number: '200', year: 1967, tier: 1,
    apelido: 'Reforma Administrativa',
    ementaCurta: 'Dispõe sobre a organização da Administração Federal, estabelece diretrizes para a Reforma Administrativa.',
    publishDate: '1967-02-25',
    hierarchyLevel: 2,
    urls: [
      'https://www.planalto.gov.br/ccivil_03/decreto-lei/del0200.htm',
      'https://www.planalto.gov.br/ccivil_03/decreto-lei/Del0200compilado.htm',
    ],
  },

  // ── TIER 2 — Muito relevantes (5) ──
  {
    type: 'lei', number: '13.019', year: 2014, tier: 2,
    apelido: 'MROSC — Marco Regulatório das OSCs',
    ementaCurta: 'Estabelece o regime jurídico das parcerias entre a administração pública e as organizações da sociedade civil.',
    publishDate: '2014-07-31',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019.htm'],
  },
  {
    type: 'lei', number: '13.146', year: 2015, tier: 2,
    apelido: 'LBI — Estatuto da Pessoa com Deficiência',
    ementaCurta: 'Institui a Lei Brasileira de Inclusão da Pessoa com Deficiência (Estatuto da Pessoa com Deficiência) — reserva de cargos em contratos administrativos.',
    publishDate: '2015-07-06',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm'],
  },
  {
    type: 'lei', number: '14.230', year: 2021, tier: 2,
    apelido: 'Reforma da Improbidade Administrativa',
    ementaCurta: 'Altera a Lei 8.429/1992 (Improbidade Administrativa), redefinindo tipos, prazos e requisitos.',
    publishDate: '2021-10-25',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14230.htm'],
  },
  {
    type: 'lei', number: '12.349', year: 2010, tier: 2,
    apelido: 'Margem de preferência (alterou Lei 8.666)',
    ementaCurta: 'Altera as Leis 8.666/1993, 8.958/1994 e 10.973/2004; institui margem de preferência para produtos e serviços nacionais em licitações.',
    publishDate: '2010-12-15',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12349.htm'],
  },
  {
    type: 'lei', number: '13.243', year: 2016, tier: 2,
    apelido: 'Marco Legal de CT&I',
    ementaCurta: 'Dispõe sobre estímulos ao desenvolvimento científico, à pesquisa, à capacitação científica e tecnológica e à inovação — altera diversas leis.',
    publishDate: '2016-01-11',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13243.htm'],
  },

  // ── TIER 3 — Relevantes (6) ──
  {
    type: 'lei', number: '9.637', year: 1998, tier: 3,
    apelido: 'OS — Organizações Sociais',
    ementaCurta: 'Dispõe sobre a qualificação de entidades como Organizações Sociais e a criação do Programa Nacional de Publicização.',
    publishDate: '1998-05-15',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/leis/l9637.htm'],
  },
  {
    type: 'lei', number: '9.790', year: 1999, tier: 3,
    apelido: 'OSCIPs — Org. da Sociedade Civil de Interesse Público',
    ementaCurta: 'Dispõe sobre a qualificação de pessoas jurídicas de direito privado, sem fins lucrativos, como Organizações da Sociedade Civil de Interesse Público — OSCIP.',
    publishDate: '1999-03-23',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/leis/l9790.htm'],
  },
  {
    type: 'lei', number: '11.107', year: 2005, tier: 3,
    apelido: 'Consórcios Públicos',
    ementaCurta: 'Dispõe sobre normas gerais de contratação de consórcios públicos entre entes federativos.',
    publishDate: '2005-04-06',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11107.htm'],
  },
  {
    type: 'lei', number: '12.598', year: 2012, tier: 3,
    apelido: 'Compras de Defesa',
    ementaCurta: 'Estabelece normas especiais para compras, contratações e desenvolvimento de produtos e sistemas de defesa.',
    publishDate: '2012-03-21',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12598.htm'],
  },
  {
    type: 'lei', number: '13.460', year: 2017, tier: 3,
    apelido: 'Direitos do Usuário de Serviços Públicos',
    ementaCurta: 'Dispõe sobre participação, proteção e defesa dos direitos do usuário dos serviços públicos da administração pública.',
    publishDate: '2017-06-26',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13460.htm'],
  },
  {
    type: 'lei', number: '11.488', year: 2007, tier: 3,
    apelido: 'Alterou LC 123 (agroindústria)',
    ementaCurta: 'Cria o Regime Especial de Incentivos para o Desenvolvimento da Infraestrutura — REIDI; altera a LC 123/2006 para incluir agroindústria como ME/EPP.',
    publishDate: '2007-06-15',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/lei/l11488.htm'],
  },

  // ── TIER 4 — Tangenciais (4) ──
  {
    type: 'lei-complementar', number: '116', year: 2003, tier: 4,
    apelido: 'ISS — Imposto sobre Serviços',
    ementaCurta: 'Dispõe sobre o Imposto Sobre Serviços de Qualquer Natureza, de competência dos Municípios e do Distrito Federal.',
    publishDate: '2003-07-31',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm'],
  },
  {
    type: 'lei', number: '13.726', year: 2018, tier: 4,
    apelido: 'Desburocratização',
    ementaCurta: 'Racionaliza atos e procedimentos administrativos dos Poderes da União, dos Estados, do DF e dos Municípios; institui o Selo de Desburocratização e Simplificação.',
    publishDate: '2018-10-08',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13726.htm'],
  },
  {
    type: 'lei', number: '12.232', year: 2010, tier: 4,
    apelido: 'Publicidade institucional',
    ementaCurta: 'Dispõe sobre normas gerais para licitação e contratação pela administração pública de serviços de publicidade prestados por intermédio de agências de propaganda.',
    publishDate: '2010-04-29',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12232.htm'],
  },
  {
    type: 'lei', number: '14.611', year: 2023, tier: 4,
    apelido: 'Igualdade salarial entre mulheres e homens',
    ementaCurta: 'Dispõe sobre a igualdade salarial e de critérios remuneratórios entre mulheres e homens — relevante para cláusulas trabalhistas em contratos administrativos.',
    publishDate: '2023-07-03',
    hierarchyLevel: 1,
    urls: ['https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14611.htm'],
  },
];

const TYPE_TITLE: Record<string, string> = {
  lei: 'Lei',
  'lei-complementar': 'Lei Complementar',
  'decreto-lei': 'Decreto-Lei',
};

/** Tenta scraper padrão; se falhar (< 1500 chars), faz fetch direto + cheerio. */
async function fetchContent(urls: string[]): Promise<{ url: string; content: string; hash?: string } | null> {
  for (const url of urls) {
    // Tentativa 1: scraper padrão
    const r = await scrapeUrl(url);
    if (r.success && r.content && r.content.length > 1500) {
      return { url, content: r.content, hash: r.hash ?? r.contentHash };
    }
    console.log(`     scraper padrão: ${r.content?.length ?? 0} chars (insuficiente, tentando fetch direto)`);

    // Tentativa 2: fetch direto + cheerio (pra páginas antigas)
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      let html: string;
      try {
        html = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        html = new TextDecoder('iso-8859-1').decode(buffer);
      }
      const $ = cheerio.load(html);
      $('script, style, nav, header, footer, .breadcrumb, iframe').remove();
      const raw = $('body').text();
      const clean = normalizeScrapedText(raw);
      if (clean.length > 1500) {
        console.log(`     ✅ fetch direto OK (${clean.length} chars)`);
        return { url, content: clean };
      }
      console.log(`     fetch direto: ${clean.length} chars (insuficiente)`);
    } catch (e) {
      console.log(`     fetch direto erro: ${(e as Error).message}`);
    }
  }
  return null;
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
  const tierArg = process.argv.find((a) => a.startsWith('--tier='));
  const tier = tierArg ? parseInt(tierArg.split('=')[1], 10) : 0;
  const skipReindex = process.argv.includes('--skip-reindex');
  const subset = tier > 0 ? LEIS.filter((l) => l.tier === tier) : LEIS;

  console.log(`📋 Importando ${subset.length} leis essenciais${tier > 0 ? ` (Tier ${tier})` : ' (todos os tiers)'}`);
  console.log(`   Modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}\n`);

  const stats: Stats = { scrapeOk: 0, scrapeFail: 0, validateFail: 0, alreadyExists: 0, created: 0, reindexed: 0 };
  const failures: { fullNumber: string; reason: string }[] = [];

  for (const lei of subset) {
    const fullNumber = `${TYPE_TITLE[lei.type]} ${lei.number}/${lei.year}`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔄 [T${lei.tier}] ${fullNumber} — ${lei.apelido}`);

    const existing = await prisma.legislativeAct.findFirst({
      where: { type: lei.type, number: lei.number, year: lei.year },
    });
    if (existing) {
      console.log(`   ⏭️  Já existe: ${existing.fullNumber}`);
      stats.alreadyExists++;
      continue;
    }

    const result = await fetchContent(lei.urls);
    if (!result) {
      console.log(`   ❌ Não consegui extrair conteúdo de nenhuma URL`);
      stats.scrapeFail++;
      failures.push({ fullNumber, reason: 'todas URLs falharam' });
      continue;
    }
    stats.scrapeOk++;
    console.log(`   ✅ ${result.content.length} chars (${result.url})`);

    const v = validateActContent({ url: result.url, content: result.content });
    if (v.errors.length > 0) {
      console.log(`   🚫 Validação:`);
      for (const e of v.errors) console.log(`      ${e}`);
      stats.validateFail++;
      failures.push({ fullNumber, reason: `validate: ${v.errors.join('; ')}` });
      continue;
    }
    for (const w of v.warnings) console.log(`   ⚠️  ${w.slice(0, 100)}`);

    const dateLabel = new Date(lei.publishDate + 'T00:00:00Z').toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    const title = `${fullNumber}, de ${dateLabel} (${lei.apelido})`;

    if (!apply) {
      console.log(`   📛 ${title}`);
      console.log(`   🔒 dry-run`);
      continue;
    }

    const created = await prisma.legislativeAct.create({
      data: {
        type: lei.type,
        number: lei.number,
        year: lei.year,
        fullNumber,
        title,
        ementa: lei.ementaCurta,
        issuer: normalizeIssuer('Presidência da República'),
        publishDate: new Date(lei.publishDate + 'T00:00:00Z'),
        hierarchyLevel: lei.hierarchyLevel,
        officialUrl: result.url,
        content: result.content,
        contentHash: result.hash,
        esfera: 'federal',
        embeddingStatus: 'pending',
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });
    stats.created++;
    console.log(`   ✨ Criado ${created.id}`);

    if (!skipReindex) {
      const reindex = await processLegislativeAct(created.id, { forceReprocess: true });
      if (reindex.success) {
        stats.reindexed++;
        console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`   Total: ${subset.length}`);
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

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
