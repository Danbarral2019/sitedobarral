/**
 * Lei 4.320/1964 — página antiga do Planalto sem seletor compatível.
 * Faz fetch direto + cheerio + extrai texto de um seletor mais genérico.
 */
import { prisma } from '../lib/prisma';
import * as cheerio from 'cheerio';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import { validateActContent } from '../lib/legislative-scrapers/validate-content';
import { processLegislativeAct } from '../lib/embeddings/legislative-act-processor';
import { normalizeIssuer } from '../lib/legislative-acts/issuers';

const URL = 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm';
const FULL_NUMBER = 'Lei 4.320/1964';
const EMENTA =
  'Estatui Normas Gerais de Direito Financeiro para elaboração e controle dos orçamentos e balanços da União, dos Estados, dos Municípios e do Distrito Federal.';
const PUBLISH_DATE = '1964-03-17';

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`📋 ${FULL_NUMBER}`);
  console.log(`   🌐 Fetching direto: ${URL}\n`);

  const response = await fetch(URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    console.log(`❌ HTTP ${response.status}`);
    process.exit(1);
  }

  // Tenta UTF-8, se falhar usa ISO-8859-1
  const buffer = await response.arrayBuffer();
  let html: string;
  try {
    html = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    html = new TextDecoder('iso-8859-1').decode(buffer);
  }
  console.log(`   📦 ${html.length} chars HTML`);

  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, .breadcrumb, iframe').remove();

  // Página antiga do Planalto: o conteúdo está num <p>...</p> grande dentro do body
  // sem container específico. Pegar todo o texto do body + filtrar.
  const text = $('body').text();
  console.log(`   📝 ${text.length} chars de texto bruto`);

  const clean = normalizeScrapedText(text);
  console.log(`   🧹 ${clean.length} chars após normalize`);
  console.log(`   início: "${clean.slice(0, 200).replace(/\n/g, ' ')}..."`);

  const v = validateActContent({ url: URL, content: clean });
  if (v.errors.length) {
    console.log(`🚫 Validação falhou:`);
    for (const e of v.errors) console.log(`   ${e}`);
    process.exit(1);
  }
  for (const w of v.warnings) console.log(`   ⚠️  ${w.slice(0, 100)}`);

  if (!apply) {
    console.log('\n🔒 dry-run');
    await prisma.$disconnect();
    return;
  }

  const existing = await prisma.legislativeAct.findFirst({
    where: { type: 'lei', number: '4.320', year: 1964 },
  });

  const dateLabel = new Date(PUBLISH_DATE + 'T00:00:00Z').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const title = `${FULL_NUMBER}, de ${dateLabel} (Normas gerais de direito financeiro)`;

  if (existing) {
    await prisma.legislativeAct.update({
      where: { id: existing.id },
      data: {
        title,
        ementa: EMENTA,
        officialUrl: URL,
        content: clean,
        embeddingStatus: 'pending',
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });
    await prisma.legislativeActChunk.deleteMany({ where: { legislativeActId: existing.id } });
    const r = await processLegislativeAct(existing.id, { forceReprocess: true });
    console.log(`   ✅ Atualizado, ${r.stats?.chunkCount ?? 0} chunks`);
  } else {
    const created = await prisma.legislativeAct.create({
      data: {
        type: 'lei',
        number: '4.320',
        year: 1964,
        fullNumber: FULL_NUMBER,
        title,
        ementa: EMENTA,
        issuer: normalizeIssuer('Presidência da República'),
        publishDate: new Date(PUBLISH_DATE + 'T00:00:00Z'),
        hierarchyLevel: 1,
        officialUrl: URL,
        content: clean,
        esfera: 'federal',
        embeddingStatus: 'pending',
        scrapeStatus: 'success',
        lastScrapedAt: new Date(),
      },
    });
    const r = await processLegislativeAct(created.id, { forceReprocess: true });
    console.log(`   ✨ Criado, ${r.stats?.chunkCount ?? 0} chunks`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
