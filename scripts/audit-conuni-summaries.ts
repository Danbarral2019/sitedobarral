import { prisma } from '../lib/prisma';

interface Doc { id: string; title: string; aiClassification: string; category: string; }

const RED_FLAGS = [
  { name: 'comeca_trata_se', re: /^(trata-se|trata se|o presente|este parecer|esta nota|esta manifesta|a manifestaç|a presente)/i },
  { name: 'repete_numero_titulo', re: /(parecer|nota|despacho)\s+n[º°.]?\s*\d{4,}/i },
  { name: 'cita_outras_leis', re: /\b(8\.666|10\.520|lei\s+8666|lei\s+10520)\b/i },
  { name: 'usa_juridiques', re: /\b(consoante|outrossim|destarte|ad cautelam|in casu|sub judice|verbi gratia|hodiernamente|conforme exposto|forçoso|cumpre destacar)\b/i },
  { name: 'autorreferente', re: /\b(o presente parecer|este parecer (?:trata|orienta|aborda|define))\b/i },
];

async function main() {
  const docs = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      aiClassification: { contains: '"summary"' },
    },
    select: { id: true, title: true, aiClassification: true, category: true },
  }) as Doc[];

  console.log(`Total com summary: ${docs.length}\n`);

  const stats = {
    total: docs.length,
    lengthHistogram: { '<100': 0, '100-200': 0, '200-300': 0, '300-400': 0, '>400': 0 },
    flagCounts: {} as Record<string, number>,
    citaArtigo: 0,
    semArtigo: 0,
  };
  for (const f of RED_FLAGS) stats.flagCounts[f.name] = 0;

  const examplesByFlag: Record<string, Array<{ title: string; summary: string }>> = {};
  for (const f of RED_FLAGS) examplesByFlag[f.name] = [];
  examplesByFlag.sem_artigo = [];
  examplesByFlag.muito_longo = [];
  examplesByFlag.muito_curto = [];

  for (const d of docs) {
    let ai: { summary?: string };
    try { ai = JSON.parse(d.aiClassification); } catch { continue; }
    const summary = (ai.summary || '').trim();
    if (!summary) continue;

    const len = summary.length;
    if (len < 100) {
      stats.lengthHistogram['<100']++;
      if (examplesByFlag.muito_curto.length < 3) examplesByFlag.muito_curto.push({ title: d.title.slice(0, 80), summary });
    } else if (len < 200) stats.lengthHistogram['100-200']++;
    else if (len < 300) stats.lengthHistogram['200-300']++;
    else if (len < 400) stats.lengthHistogram['300-400']++;
    else {
      stats.lengthHistogram['>400']++;
      if (examplesByFlag.muito_longo.length < 3) examplesByFlag.muito_longo.push({ title: d.title.slice(0, 80), summary });
    }

    for (const f of RED_FLAGS) {
      if (f.re.test(summary)) {
        stats.flagCounts[f.name]++;
        if (examplesByFlag[f.name].length < 3) {
          examplesByFlag[f.name].push({ title: d.title.slice(0, 80), summary });
        }
      }
    }

    const citaArt = /\bart(?:igo|\.)\s*\d+\b/i.test(summary) || /\bartigos?\s+\d+\b/i.test(summary);
    if (citaArt) stats.citaArtigo++;
    else {
      stats.semArtigo++;
      if (examplesByFlag.sem_artigo.length < 5) {
        examplesByFlag.sem_artigo.push({ title: d.title.slice(0, 80), summary });
      }
    }
  }

  console.log('=== Distribuição de tamanho (caracteres) ===');
  Object.entries(stats.lengthHistogram).forEach(([k, v]) => console.log(`  ${k}: ${v} (${pct(v, stats.total)})`));

  console.log('\n=== Red flags ===');
  Object.entries(stats.flagCounts).forEach(([k, v]) => console.log(`  ${k}: ${v} (${pct(v, stats.total)})`));
  console.log(`  sem citar artigo: ${stats.semArtigo} (${pct(stats.semArtigo, stats.total)})`);
  console.log(`  cita artigo: ${stats.citaArtigo} (${pct(stats.citaArtigo, stats.total)})`);

  console.log('\n=== Exemplos por flag ===');
  for (const [flag, exs] of Object.entries(examplesByFlag)) {
    if (exs.length === 0) continue;
    console.log(`\n--- ${flag} (${exs.length} amostras) ---`);
    for (const e of exs) {
      console.log(`  ${e.title}`);
      console.log(`    "${e.summary}"`);
    }
  }

  await prisma.$disconnect();
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

main().catch(e => { console.error(e); process.exit(1); });
