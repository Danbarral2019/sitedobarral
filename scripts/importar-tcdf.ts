/**
 * Carga inicial da jurisprudência do TCDF (decisões publicadas do tema
 * "Licitações e Contratos"). Sem --aplicar, só simula: baixa o acervo,
 * classifica por palavra-chave e conta, sem gravar nada.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/importar-tcdf.ts            # simulação
 *   npx dotenv -e .env.local -- npx tsx scripts/importar-tcdf.ts --aplicar  # grava
 *
 * Custo ao aplicar: 1 resumo no Gemini por decisão aprovada.
 */
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { tcdfScraper, buscarDecisoesTcdf, hitParaDecisao } from '@/lib/tribunal-scrapers/tcdf';
import { classifyDecision } from '@/lib/tribunal-scrapers/classifier';

async function main() {
  if (process.argv.includes('--aplicar')) {
    const r = await tcdfScraper.scrape({ acervoCompleto: true, maxItems: 5000, tempoMaxMs: Infinity });
    console.log(JSON.stringify({ ...r, errors: r.errors.slice(0, 10) }, null, 1));
    return;
  }

  const t0 = Date.now();
  const hits = await buscarDecisoesTcdf();
  console.log(`acervo: ${hits.length} decisões em ${Math.round((Date.now() - t0) / 1000)} s`);
  const porAno: Record<string, number> = {};
  const status: Record<string, number> = {};
  const exemplos: Record<string, string[]> = {};
  for (const h of hits) {
    const d = hitParaDecisao(h);
    const ano = d.dataJulgamento?.getFullYear() ?? 'sem data';
    porAno[ano] = (porAno[ano] || 0) + 1;
    const c = await classifyDecision({ title: d.title, ementa: d.ementa, fullText: d.fullText, decisionType: 'decisao', tribunalCode: 'TCDF' });
    status[c.approvalStatus] = (status[c.approvalStatus] || 0) + 1;
    (exemplos[c.approvalStatus] ||= []).length < 3 && exemplos[c.approvalStatus].push(`${d.title} | ${d.ementa.slice(0, 140).replace(/\s+/g, ' ')}`);
  }
  console.log('por ano:', porAno);
  console.log('classificação por palavra-chave:', status);
  for (const [s, e] of Object.entries(exemplos)) {
    console.log(`\n${s}:`);
    e.forEach((x) => console.log('  ' + x));
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
