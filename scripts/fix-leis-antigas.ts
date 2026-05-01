/**
 * Tenta URLs alternativas (compiladas/atualizadas) pra leis antigas que
 * o scraper do Planalto não consegue extrair (página com layout antigo).
 */
import { prisma } from '../lib/prisma';
import { scrapeUrl } from '../lib/legislative-scrapers';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer } from '../lib/legislative-acts/issuers';

interface Target {
  type: 'lei' | 'lei-complementar' | 'decreto-lei';
  number: string;
  year: number;
  apelido: string;
  ementaCurta: string;
  publishDate: string;
  hierarchyLevel: 1 | 2;
  /** URLs alternativas a tentar em ordem */
  urls: string[];
}

const TARGETS: Target[] = [
  {
    type: 'lei',
    number: '4.320',
    year: 1964,
    apelido: 'Normas gerais de direito financeiro',
    ementaCurta:
      'Estatui Normas Gerais de Direito Financeiro para elaboração e controle dos orçamentos e balanços da União, dos Estados, dos Municípios e do Distrito Federal.',
    publishDate: '1964-03-17',
    hierarchyLevel: 1,
    urls: [
      'https://www.planalto.gov.br/ccivil_03/leis/l4320compilado.htm',
      'https://www.planalto.gov.br/ccivil_03/leis/L4320.htm',
      'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm',
    ],
  },
  {
    type: 'lei',
    number: '5.452',
    year: 1943,
    apelido: 'CLT — Consolidação das Leis do Trabalho',
    ementaCurta: 'Aprova a Consolidação das Leis do Trabalho.',
    publishDate: '1943-05-01',
    hierarchyLevel: 1,
    urls: [
      'https://www.planalto.gov.br/ccivil_03/Decreto-Lei/Del5452compilado.htm',
      'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm',
      'https://www.planalto.gov.br/ccivil_03/Decreto-Lei/Del5452.htm',
    ],
  },
];

const TYPE_TITLE: Record<string, string> = {
  lei: 'Lei',
  'lei-complementar': 'Lei Complementar',
  'decreto-lei': 'Decreto-Lei',
};

async function tryUrls(urls: string[]): Promise<{ url: string; content: string; hash?: string } | null> {
  for (const url of urls) {
    console.log(`   🌐 ${url}`);
    const r = await scrapeUrl(url);
    if (r.success && r.content && r.content.length > 1500) {
      console.log(`   ✅ OK (${r.content.length} chars)`);
      return { url, content: r.content, hash: r.hash ?? r.contentHash };
    }
    console.log(`   ❌ falha (${r.content?.length ?? 0} chars / ${r.error ?? 'sem error'})`);
  }
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  for (const t of TARGETS) {
    const fullNumber = `${TYPE_TITLE[t.type]} ${t.number}/${t.year}`;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📋 ${fullNumber} — ${t.apelido}`);

    const result = await tryUrls(t.urls);
    if (!result) {
      console.log(`❌ Nenhuma URL funcionou — marcar como manual`);
      continue;
    }

    const v = validateActContent({ url: result.url, content: result.content });
    if (v.errors.length) {
      console.log(`🚫 Validação falhou:`);
      for (const e of v.errors) console.log(`   ${e}`);
      continue;
    }
    for (const w of v.warnings) console.log(`   ⚠️  ${w.slice(0, 100)}`);

    if (!apply) {
      console.log(`🔒 dry-run — use --apply pra escrever`);
      continue;
    }

    const existing = await prisma.legislativeAct.findFirst({
      where: { type: t.type, number: t.number, year: t.year },
    });

    const dateLabel = new Date(t.publishDate + 'T00:00:00Z').toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const title = `${fullNumber}, de ${dateLabel} (${t.apelido})`;

    if (existing) {
      console.log(`   ⚙️  Atualizando existente ${existing.id}`);
      await prisma.legislativeAct.update({
        where: { id: existing.id },
        data: {
          title,
          ementa: t.ementaCurta,
          officialUrl: result.url,
          content: result.content,
          contentHash: result.hash,
          embeddingStatus: 'pending',
          scrapeStatus: 'success',
          lastScrapedAt: new Date(),
        },
      });
      const deleted = await prisma.legislativeActChunk.deleteMany({
        where: { legislativeActId: existing.id },
      });
      console.log(`   ✅ ${deleted.count} chunks removidos`);
      const reindex = await processLegislativeAct(existing.id, { forceReprocess: true });
      console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks novos`);
    } else {
      const created = await prisma.legislativeAct.create({
        data: {
          type: t.type,
          number: t.number,
          year: t.year,
          fullNumber,
          title,
          ementa: t.ementaCurta,
          issuer: normalizeIssuer('Presidência da República'),
          publishDate: new Date(t.publishDate + 'T00:00:00Z'),
          hierarchyLevel: t.hierarchyLevel,
          officialUrl: result.url,
          content: result.content,
          contentHash: result.hash,
          esfera: 'federal',
          embeddingStatus: 'pending',
          scrapeStatus: 'success',
          lastScrapedAt: new Date(),
        },
      });
      console.log(`   ✨ Criado: ${created.id}`);
      const reindex = await processLegislativeAct(created.id, { forceReprocess: true });
      console.log(`   🧠 ${reindex.stats?.chunkCount ?? 0} chunks`);
    }
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
