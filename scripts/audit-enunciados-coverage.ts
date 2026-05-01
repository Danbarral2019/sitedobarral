/**
 * Audit de cobertura dos enunciados (CJF/IBDA/INCP) — verifica numeração,
 * duplicatas, gaps, formatação.
 *
 * Memory 2026-04-30 audit: CJF/IBDA 100% match; INCP parcial.
 * Re-confirmar e identificar drift.
 */
import { prisma } from '../lib/prisma';

const SOURCES = ['CJF', 'IBDA', 'INCP'] as const;
type Source = (typeof SOURCES)[number];

interface Enunciado {
  id: string;
  source: Source | null;
  numero: number | null;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
}

function parseTitle(title: string): { source: Source | null; numero: number | null } {
  const m = title.match(/Enunciado\s+(?:do\s+)?(CJF|IBDA|INCP)\s+n[º°o.]?\s*(\d+)/i);
  if (!m) return { source: null, numero: null };
  return { source: m[1].toUpperCase() as Source, numero: parseInt(m[2], 10) };
}

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'enunciados' },
    select: { id: true, title: true, description: true, content: true, url: true },
  });

  const enunciados: Enunciado[] = docs.map((d) => {
    const { source, numero } = parseTitle(d.title);
    return { id: d.id, source, numero, title: d.title, description: d.description, content: d.content, url: d.url };
  });

  // Sanity: títulos não-parseáveis
  const unparsed = enunciados.filter((e) => !e.source || e.numero === null);
  if (unparsed.length > 0) {
    console.log(`⚠️  ${unparsed.length} título(s) não casaram com padrão:`);
    for (const u of unparsed.slice(0, 5)) console.log(`   - "${u.title}"`);
    if (unparsed.length > 5) console.log(`   ... +${unparsed.length - 5}`);
  }

  // Por source
  for (const src of SOURCES) {
    const items = enunciados.filter((e) => e.source === src && e.numero !== null);
    const numeros = items.map((e) => e.numero!).sort((a, b) => a - b);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${src}: ${items.length} enunciados`);

    // Duplicatas
    const counts = new Map<number, number>();
    for (const n of numeros) counts.set(n, (counts.get(n) ?? 0) + 1);
    const dups = [...counts.entries()].filter(([, c]) => c > 1);
    if (dups.length > 0) {
      console.log(`   ❌ ${dups.length} duplicata(s):`);
      for (const [n, c] of dups) console.log(`      nº ${n}: ${c}× (provavelmente import duplicado)`);
    } else {
      console.log(`   ✅ Sem duplicatas`);
    }

    // Range + gaps
    const min = Math.min(...numeros);
    const max = Math.max(...numeros);
    const expected = new Set<number>();
    for (let i = min; i <= max; i++) expected.add(i);
    for (const n of numeros) expected.delete(n);
    const gaps = [...expected].sort((a, b) => a - b);
    console.log(`   Range: ${min}–${max} (${max - min + 1} esperados)`);
    if (gaps.length > 0) {
      console.log(`   ⚠️  ${gaps.length} faltando: ${gaps.slice(0, 30).join(', ')}${gaps.length > 30 ? `... +${gaps.length - 30}` : ''}`);
    } else {
      console.log(`   ✅ Sem gaps`);
    }

    // Sample formato dos primeiros 3
    console.log(`\n   Sample (primeiros 3 ordenados):`);
    const sorted = items.slice().sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)).slice(0, 3);
    for (const e of sorted) {
      const desc = (e.description ?? '').slice(0, 90);
      console.log(`      nº ${e.numero}: ${desc}${desc.length === 90 ? '...' : ''}`);
    }
  }

  // URL stability — todos casam o issuer?
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔗 Consistência URL × source:`);
  for (const src of SOURCES) {
    const items = enunciados.filter((e) => e.source === src);
    const expectedHostMap: Record<Source, string> = {
      CJF: 'cjf.jus.br',
      IBDA: 'ibda.com.br',
      INCP: 'incpbrasil.com.br',
    };
    const expectedHost = expectedHostMap[src];
    const mismatched = items.filter((e) => {
      if (!e.url) return false;
      try {
        const h = new URL(e.url).hostname;
        return !h.includes(expectedHost);
      } catch {
        return true;
      }
    });
    const semUrl = items.filter((e) => !e.url).length;
    console.log(`   ${src}: ${items.length - mismatched.length - semUrl}/${items.length} URL bate; ${mismatched.length} mismatched; ${semUrl} sem URL`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
