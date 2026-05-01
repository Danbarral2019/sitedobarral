/**
 * Audit de qualidade textual dos enunciados (CJF/IBDA/INCP).
 *
 * Verifica:
 * - title segue padrão "Enunciado do <SOURCE> nº <NUM>"
 * - description tem o texto do enunciado (não truncado, não vazio)
 * - description não termina abruptamente (sinal de truncate)
 * - não há boilerplate residual ("Compartilhe", "Voltar", etc)
 * - description não duplica title
 */
import { prisma } from '../lib/prisma';

interface Issue {
  source: string;
  numero: number;
  title: string;
  code: string;
  detail: string;
}

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'enunciados' },
    select: { title: true, description: true, content: true },
  });

  const issues: Issue[] = [];
  const lengthHistogram = { lt100: 0, lt200: 0, lt500: 0, lt1000: 0, gte1000: 0 };

  for (const d of docs) {
    const m = d.title.match(/Enunciado\s+(?:do\s+)?(CJF|IBDA|INCP)\s+n[º°o.]?\s*(\d+)/i);
    if (!m) continue;
    const source = m[1].toUpperCase();
    const numero = parseInt(m[2], 10);
    const desc = d.description ?? '';
    const len = desc.length;

    // Histogram
    if (len < 100) lengthHistogram.lt100++;
    else if (len < 200) lengthHistogram.lt200++;
    else if (len < 500) lengthHistogram.lt500++;
    else if (len < 1000) lengthHistogram.lt1000++;
    else lengthHistogram.gte1000++;

    // Vazio ou muito curto
    if (!desc.trim()) {
      issues.push({ source, numero, title: d.title, code: 'EMPTY_DESC', detail: '' });
      continue;
    }
    if (len < 50) {
      issues.push({ source, numero, title: d.title, code: 'TOO_SHORT', detail: `${len} chars` });
    }

    // Termina abruptamente (sem ponto, vírgula, fechando aspas/parênteses)
    const lastChar = desc.trim().slice(-1);
    if (!/[.;:!?)"'»]/.test(lastChar)) {
      issues.push({ source, numero, title: d.title, code: 'NO_TERMINAL', detail: `termina em "${desc.trim().slice(-30)}"` });
    }

    // Boilerplate
    if (/Compartilhe|Curtir|Imprimir|Voltar para/i.test(desc)) {
      issues.push({ source, numero, title: d.title, code: 'BOILERPLATE', detail: desc.slice(0, 60) });
    }

    // Description = title (cópia em vez de texto)
    if (desc.trim() === d.title.trim()) {
      issues.push({ source, numero, title: d.title, code: 'DESC_EQ_TITLE', detail: '' });
    }

    // Description começa repetindo o nº (artefato de scrape — "Enunciado nº X. <texto>")
    if (/^Enunciado\s+(?:do\s+)?(CJF|IBDA|INCP)\s+n[º°o.]?\s*\d+/i.test(desc)) {
      issues.push({ source, numero, title: d.title, code: 'DESC_REPEATS_TITLE', detail: desc.slice(0, 60) });
    }

    // Não menciona Lei 14.133 (tolerância — esperado em maioria)
    // (skip — pode ser enunciado sobre tema correlato)
  }

  console.log(`📊 ${docs.length} enunciados auditados\n`);

  console.log(`Histograma de tamanho de description:`);
  console.log(`   < 100 chars:    ${lengthHistogram.lt100}`);
  console.log(`   100–200:        ${lengthHistogram.lt200}`);
  console.log(`   200–500:        ${lengthHistogram.lt500}`);
  console.log(`   500–1000:       ${lengthHistogram.lt1000}`);
  console.log(`   ≥ 1000:         ${lengthHistogram.gte1000}`);

  console.log(`\n${'─'.repeat(80)}`);
  if (issues.length === 0) {
    console.log(`✅ Sem issues de qualidade textual.`);
  } else {
    console.log(`⚠️  ${issues.length} issue(s):\n`);
    const byCode = new Map<string, Issue[]>();
    for (const i of issues) {
      const arr = byCode.get(i.code) ?? [];
      arr.push(i);
      byCode.set(i.code, arr);
    }
    for (const [code, items] of byCode) {
      console.log(`\n[${code}] (${items.length}):`);
      for (const i of items.slice(0, 10)) {
        console.log(`   ${i.source} nº ${i.numero}: ${i.detail || '(no detail)'}`);
      }
      if (items.length > 10) console.log(`   ... +${items.length - 10}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
