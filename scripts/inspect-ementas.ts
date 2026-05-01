/**
 * Read-only diagnostic: inspeciona ementas das leis no banco para
 * detectar problemas de formatação. Não escreve nada.
 *
 * Uso: npx tsx scripts/inspect-ementas.ts [--all] [--limit=N]
 *
 * Sem --all, mostra só as ementas que têm sinais de ruído.
 */
import { prisma } from '../lib/prisma';

interface Issue {
  code: string;
  desc: string;
}

function diagnose(text: string): Issue[] {
  const issues: Issue[] = [];

  // 1. NBSP / espaço unicode
  if (/ /.test(text)) issues.push({ code: 'NBSP', desc: 'tem U+00A0 (NBSP)' });

  // 2. múltiplos espaços
  if (/  +/.test(text)) issues.push({ code: 'MULTI_SPACE', desc: 'tem múltiplos espaços seguidos' });

  // 3. quebras de linha estranhas
  if (/\n{3,}/.test(text)) issues.push({ code: 'MULTI_NEWLINE', desc: '3+ \\n consecutivos' });
  if (/\r/.test(text)) issues.push({ code: 'CR', desc: 'tem \\r (carriage return)' });

  // 4. trailing/leading whitespace
  if (text !== text.trim()) issues.push({ code: 'EDGES', desc: 'whitespace nas bordas' });

  // 5. Característica de scrape de Planalto (vide texto compilado em HTML)
  if (/^Presidência da República/im.test(text)) issues.push({ code: 'HEADER_PRESIDENCIA', desc: 'header institucional vazado' });
  if (/^Brasão das Armas/im.test(text)) issues.push({ code: 'HEADER_BRASAO', desc: 'tem "Brasão das Armas"' });
  if (/^Casa Civil/im.test(text)) issues.push({ code: 'HEADER_CASACIVIL', desc: 'tem "Casa Civil"' });
  if (/^Subchefia para Assuntos Jurídicos/im.test(text)) issues.push({ code: 'HEADER_SUBCHEFIA', desc: 'tem "Subchefia"' });

  // 6. Boilerplate DOU/gov.br
  if (/Brasão do Brasil/.test(text)) issues.push({ code: 'BOILER_DOU', desc: 'tem "Brasão do Brasil" (DOU)' });
  if (/Compartilhe\s*:/i.test(text)) issues.push({ code: 'BOILER_SHARE', desc: 'tem "Compartilhe:"' });
  if (/^link para Copiar/im.test(text)) issues.push({ code: 'BOILER_COPIAR', desc: 'tem "link para Copiar"' });
  if (/Publicado em\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}h\d{1,2}/.test(text)) issues.push({ code: 'BOILER_PUBLICADO', desc: 'tem "Publicado em DD/MM/AAAA HHhMM"' });
  if (/(?:•[^\n•]*){3,}/.test(text)) issues.push({ code: 'BOILER_BULLETS', desc: 'tem 3+ • em sequência (sidebar gov.br)' });

  // 7. Caracteres unicode esquisitos / mojibake
  if (/�/.test(text)) issues.push({ code: 'MOJIBAKE_FFFD', desc: 'tem U+FFFD (replacement char)' });
  if (/Ã[©³¡§ª¢]/.test(text)) issues.push({ code: 'MOJIBAKE_LATIN', desc: 'parece mojibake latin1→utf8 ("Ã©" etc)' });
  if (/​|‌|‍|﻿/.test(text)) issues.push({ code: 'ZERO_WIDTH', desc: 'tem zero-width chars' });

  // 8. HTML escapando
  if (/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#\d+;/.test(text)) issues.push({ code: 'HTML_ENTITIES', desc: 'tem HTML entities não decodificados' });
  if (/<[a-zA-Z][^>]{0,50}>/.test(text)) issues.push({ code: 'HTML_TAGS', desc: 'tem tags HTML' });

  // 9. Linhas pontilhadas (artefato de PDF)
  if (/\.{4,}/.test(text)) issues.push({ code: 'DOTS', desc: 'tem 4+ pontos seguidos (sumário PDF?)' });

  // 10. Hifenização de quebra de linha (PDF→texto)
  if (/-\s*\n\s*[a-záéíóúâêôãõç]/i.test(text)) issues.push({ code: 'HYPHEN_BREAK', desc: 'tem hifen-quebra-de-linha (PDF)' });

  // 11. (VETADO) sem formatação
  if (/\(VETADO\)/.test(text)) issues.push({ code: 'VETADO', desc: 'tem "(VETADO)"' });

  // 12. "Vide Decreto..." anotação solta
  if (/^Vide\s+(Decreto|Lei|Medida Provisória)/im.test(text)) issues.push({ code: 'VIDE_NOTE', desc: 'tem "Vide Decreto..." solto' });

  // 13. ALL CAPS desnecessário
  // Se a ementa inteira é ALL CAPS (tirando números/pontuação)
  const upper = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (upper.length > 30 && upper === upper.toUpperCase() && /[A-ZÀ-Ÿ]/.test(upper)) {
    issues.push({ code: 'ALL_CAPS', desc: 'ementa inteira em ALL CAPS' });
  }

  return issues;
}

async function main() {
  const all = process.argv.includes('--all');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;
  const onlyType = process.argv.find((a) => a.startsWith('--type='))?.split('=')[1];
  const showSamples = process.argv.includes('--samples');

  const where = onlyType ? { type: onlyType } : {};
  const acts = await prisma.legislativeAct.findMany({
    where,
    select: {
      id: true,
      type: true,
      fullNumber: true,
      ementa: true,
      title: true,
    },
    orderBy: [{ type: 'asc' }, { year: 'desc' }],
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(`📋 ${acts.length} atos no banco\n`);

  const byCode = new Map<string, { count: number; samples: string[] }>();
  let cleanCount = 0;
  const dirty: { fullNumber: string; issues: Issue[]; ementa: string }[] = [];

  for (const a of acts) {
    const issues = diagnose(a.ementa);
    if (issues.length === 0) {
      cleanCount++;
      continue;
    }
    dirty.push({ fullNumber: a.fullNumber, issues, ementa: a.ementa });
    for (const i of issues) {
      const e = byCode.get(i.code) ?? { count: 0, samples: [] };
      e.count++;
      if (e.samples.length < 3) e.samples.push(a.fullNumber);
      byCode.set(i.code, e);
    }
  }

  console.log(`✅ ${cleanCount} ementas sem problemas detectados`);
  console.log(`⚠️  ${dirty.length} ementas com problema(s)\n`);

  console.log(`📊 Por código de problema (count + 3 amostras):`);
  const sorted = [...byCode.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [code, info] of sorted) {
    console.log(`   ${code.padEnd(20)} ${String(info.count).padStart(4)}× → ${info.samples.join(', ')}`);
  }

  if (showSamples || all) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 EMENTAS PROBLEMÁTICAS (full text):\n`);
    const toShow = all ? dirty : dirty.slice(0, 10);
    for (const d of toShow) {
      console.log(`\n── ${d.fullNumber} ──`);
      console.log(`   problemas: ${d.issues.map((i) => i.code).join(', ')}`);
      console.log(`   ${JSON.stringify(d.ementa.slice(0, 500))}`);
      if (d.ementa.length > 500) console.log(`   ... [${d.ementa.length - 500} chars omitidos]`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
