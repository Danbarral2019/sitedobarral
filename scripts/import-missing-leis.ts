/**
 * Importa as 8 leis/LCs/DLs exigidas pelo usuário que estavam faltando
 * + re-scrape Lei 5.452/1943 (CLT) com falha histórica de scrape.
 *
 * Pipeline: scrape Planalto → validate → cria registro + reindex.
 *
 * Tipos:
 *   - lei
 *   - lei-complementar
 *   - decreto-lei
 *
 * Issuer: sempre 'Presidência da República' (canônico).
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer } from '../lib/legislative-acts/issuers';

interface LeiToImport {
  type: 'lei' | 'lei-complementar' | 'decreto-lei';
  number: string;
  year: number;
  apelido: string;
  ementaCurta: string;
  url: string;
  /** YYYY-MM-DD — data exata de publicação */
  publishDate: string;
  hierarchyLevel: 1 | 2;
}

const LEIS: LeiToImport[] = [
  {
    type: 'lei',
    number: '14.973',
    year: 2024,
    apelido: 'Alterou a Lei do CADIN',
    ementaCurta:
      'Altera a Lei nº 10.522/2002 (CADIN) e dispõe sobre regularização tributária, entre outras providências.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14973.htm',
    publishDate: '2024-09-16',
    hierarchyLevel: 1,
  },
  {
    type: 'lei',
    number: '12.305',
    year: 2010,
    apelido: 'PNRS — Política Nacional de Resíduos Sólidos',
    ementaCurta:
      'Institui a Política Nacional de Resíduos Sólidos; altera a Lei nº 9.605/1998; e dá outras providências.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12305.htm',
    publishDate: '2010-08-02',
    hierarchyLevel: 1,
  },
  {
    type: 'lei',
    number: '14.195',
    year: 2021,
    apelido: 'Tradução juramentada e ambiente de negócios',
    ementaCurta:
      'Dispõe sobre a facilitação para abertura de empresas, a proteção de acionistas minoritários e a tradução juramentada.',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14195.htm',
    publishDate: '2021-08-26',
    hierarchyLevel: 1,
  },
  {
    type: 'lei',
    number: '8.429',
    year: 1992,
    apelido: 'Lei de Improbidade Administrativa',
    ementaCurta:
      'Dispõe sobre as sanções aplicáveis em virtude da prática de atos de improbidade administrativa.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
    publishDate: '1992-06-02',
    hierarchyLevel: 1,
  },
  {
    type: 'lei',
    number: '4.320',
    year: 1964,
    apelido: 'Normas gerais de direito financeiro',
    ementaCurta:
      'Estatui Normas Gerais de Direito Financeiro para elaboração e controle dos orçamentos e balanços da União, dos Estados, dos Municípios e do Distrito Federal.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm',
    publishDate: '1964-03-17',
    hierarchyLevel: 1,
  },
  {
    type: 'lei',
    number: '10.522',
    year: 2002,
    apelido: 'CADIN — Cadastro Informativo',
    ementaCurta:
      'Dispõe sobre o Cadastro Informativo dos créditos não quitados de órgãos e entidades federais (CADIN).',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10522.htm',
    publishDate: '2002-07-19',
    hierarchyLevel: 1,
  },
  {
    type: 'lei-complementar',
    number: '101',
    year: 2000,
    apelido: 'LRF — Lei de Responsabilidade Fiscal',
    ementaCurta:
      'Estabelece normas de finanças públicas voltadas para a responsabilidade na gestão fiscal.',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm',
    publishDate: '2000-05-04',
    hierarchyLevel: 1,
  },
  {
    type: 'decreto-lei',
    number: '4.657',
    year: 1942,
    apelido: 'LINDB — Lei de Introdução às Normas',
    ementaCurta:
      'Lei de Introdução às Normas do Direito Brasileiro (antiga Lei de Introdução ao Código Civil).',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657.htm',
    publishDate: '1942-09-04',
    hierarchyLevel: 2,
  },
];

const TYPE_TITLE: Record<string, string> = {
  lei: 'Lei',
  'lei-complementar': 'Lei Complementar',
  'decreto-lei': 'Decreto-Lei',
};

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
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : LEIS.length;
  const skipReindex = process.argv.includes('--skip-reindex');
  const subset = LEIS.slice(0, limit);

  console.log(`📋 Importando ${subset.length} leis/LCs/DLs`);
  console.log(`   Modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}${skipReindex ? ' --skip-reindex' : ''}\n`);

  const stats: Stats = { scrapeOk: 0, scrapeFail: 0, validateFail: 0, alreadyExists: 0, created: 0, reindexed: 0 };
  const failures: { fullNumber: string; reason: string }[] = [];

  for (const lei of subset) {
    const fullNumber = `${TYPE_TITLE[lei.type]} ${lei.number}/${lei.year}`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔄 ${fullNumber} — ${lei.apelido}`);

    const existing = await prisma.legislativeAct.findFirst({
      where: { type: lei.type, number: lei.number, year: lei.year },
    });
    if (existing) {
      console.log(`   ⏭️  Já existe: ${existing.fullNumber}`);
      stats.alreadyExists++;
      continue;
    }

    console.log(`   🌐 Scraping ${lei.url}`);
    const result = await scrapeUrl(lei.url);
    if (!result.success || !result.content) {
      console.log(`   ❌ Scrape falhou: ${result.error}`);
      stats.scrapeFail++;
      failures.push({ fullNumber, reason: `scrape: ${result.error ?? 'sem conteúdo'}` });
      continue;
    }
    stats.scrapeOk++;
    console.log(`   ✅ ${result.content.length} chars`);

    const validation = validateActContent({ url: lei.url, content: result.content });
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

    const dateLabel = new Date(lei.publishDate + 'T00:00:00Z').toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const title = `${fullNumber}, de ${dateLabel} (${lei.apelido})`;
    console.log(`   📛 ${title}`);
    console.log(`   📝 ${lei.ementaCurta.slice(0, 100)}...`);

    if (!apply) {
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
        officialUrl: lei.url,
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

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
