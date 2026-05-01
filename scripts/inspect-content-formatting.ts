/**
 * Read-only diagnostic do campo `content` (texto integral) das leis.
 *
 * Reusa heurísticas de inspect-ementas.ts mas adaptadas para corpo de ato:
 * algumas coisas que são problema na ementa (NBSP, multi-newline) podem ser
 * legítimas no texto integral, outras não.
 */
import { prisma } from '../lib/prisma';

interface Issue {
  code: string;
  desc: string;
  /** quantas ocorrências aparecem no texto */
  count?: number;
}

function diagnose(text: string): Issue[] {
  const issues: Issue[] = [];

  // 1. mojibake (acento broken)
  const fffd = (text.match(/�/g) ?? []).length;
  if (fffd > 0) issues.push({ code: 'MOJIBAKE_FFFD', desc: `${fffd}× U+FFFD`, count: fffd });

  const latinMojibake = (text.match(/Ã[©³¡§ª¢¨¶µ½´]/g) ?? []).length;
  if (latinMojibake > 5) issues.push({ code: 'MOJIBAKE_LATIN', desc: `${latinMojibake}× "Ã[char]"`, count: latinMojibake });

  // 2. CR (carriage return — deve ter virado \n no normalize)
  const cr = (text.match(/\r/g) ?? []).length;
  if (cr > 0) issues.push({ code: 'CR', desc: `${cr}× \\r`, count: cr });

  // 3. NBSP (em texto de lei, é geralmente artefato de copy-paste)
  const nbsp = (text.match(/ /g) ?? []).length;
  if (nbsp > 0) issues.push({ code: 'NBSP', desc: `${nbsp}× U+00A0`, count: nbsp });

  // 4. Múltiplos espaços
  const multiSpace = (text.match(/  +/g) ?? []).length;
  if (multiSpace > 5) issues.push({ code: 'MULTI_SPACE', desc: `${multiSpace}× espaços duplos+`, count: multiSpace });

  // 5. 3+ \n consecutivos
  const multiNewline = (text.match(/\n{3,}/g) ?? []).length;
  if (multiNewline > 0) issues.push({ code: 'MULTI_NEWLINE', desc: `${multiNewline}× 3+\\n`, count: multiNewline });

  // 6. zero-width chars
  const zw = (text.match(/[​‌‍﻿]/g) ?? []).length;
  if (zw > 0) issues.push({ code: 'ZERO_WIDTH', desc: `${zw}× zero-width`, count: zw });

  // 7. HTML entities não decodificados
  if (/&nbsp;|&amp;|&lt;|&gt;|&quot;/.test(text)) issues.push({ code: 'HTML_ENTITIES', desc: 'tem HTML entities' });
  // tags HTML
  const tags = text.match(/<[a-zA-Z][^>]{0,80}>/g) ?? [];
  if (tags.length > 0) issues.push({ code: 'HTML_TAGS', desc: `${tags.length} tag(s)`, count: tags.length });

  // 8. Boilerplate de header institucional ainda presente
  if (/^Presidência da República\s*$/m.test(text)) issues.push({ code: 'HEADER_PRESIDENCIA', desc: '"Presidência da República" como linha solta' });
  if (/^Brasão das Armas/m.test(text)) issues.push({ code: 'HEADER_BRASAO_ARMAS', desc: '"Brasão das Armas"' });
  if (/^Casa Civil\s*$/m.test(text)) issues.push({ code: 'HEADER_CASA_CIVIL', desc: '"Casa Civil"' });
  if (/^Subchefia para Assuntos Jurídicos/m.test(text)) issues.push({ code: 'HEADER_SUBCHEFIA', desc: '"Subchefia"' });

  // 9. Boilerplate DOU/gov.br
  if (/Brasão do Brasil/.test(text)) issues.push({ code: 'BOILER_DOU_BRASAO', desc: 'tem "Brasão do Brasil"' });
  if (/^link para Copiar para área de transferência/m.test(text)) issues.push({ code: 'BOILER_COPIAR', desc: 'tem "link para Copiar..."' });
  if (/Compartilhe\s*:/i.test(text)) issues.push({ code: 'BOILER_SHARE', desc: 'tem "Compartilhe:"' });

  // 10. Linhas pontilhadas (sumário PDF)
  const dots = (text.match(/\.{6,}/g) ?? []).length;
  if (dots > 0) issues.push({ code: 'DOTS_LONG', desc: `${dots}× 6+ pontos`, count: dots });

  // 11. Hifenização vinda de quebra de PDF
  const hyphenBreak = (text.match(/[a-záéíóúâêôãõç]-\n[a-záéíóúâêôãõç]/gi) ?? []).length;
  if (hyphenBreak > 0) issues.push({ code: 'HYPHEN_BREAK', desc: `${hyphenBreak}× hífen+\\n+letra`, count: hyphenBreak });

  // 12. "Vide Decreto" anotação solta (do compilado planalto)
  const vide = (text.match(/^Vide\s+(Decreto|Lei|Medida Provisória|Emenda)/gm) ?? []).length;
  if (vide > 0) issues.push({ code: 'VIDE_NOTE', desc: `${vide}× "Vide ..."`, count: vide });

  // 13. (VETADO) — formatação inconsistente
  const vetado = (text.match(/\(VETADO\)/g) ?? []).length;
  if (vetado > 0) issues.push({ code: 'VETADO', desc: `${vetado}× "(VETADO)"`, count: vetado });

  // 14. Estranho: caracteres unicode "ordinal" U+00BA / U+00AA confusos com 'o'/'a'
  // (é OK ter, normalmente, mas vou contar se tem muito)
  // skip — válido em texto de lei (1º, 2º etc)

  // 15. Listas com bullets esquisitos (cauda de scrape mal feito)
  const bulletBlocks = (text.match(/(?:•[^\n•]*){4,}/g) ?? []).length;
  if (bulletBlocks > 0) issues.push({ code: 'BULLET_RUN', desc: `${bulletBlocks}× bloco com 4+ •`, count: bulletBlocks });

  // 16. Boilerplate "Este texto não substitui" duplicado
  const naoSubstitui = (text.match(/Este texto não substitui/g) ?? []).length;
  if (naoSubstitui > 1) issues.push({ code: 'NAO_SUBSTITUI_DUP', desc: `${naoSubstitui}× "Este texto não substitui"`, count: naoSubstitui });

  // 17. EDGES whitespace
  if (text !== text.trim()) issues.push({ code: 'EDGES', desc: 'whitespace nas bordas' });

  return issues;
}

async function main() {
  const onlyType = process.argv.find((a) => a.startsWith('--type='))?.split('=')[1];
  const onlyId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];
  const showSamples = process.argv.includes('--samples');

  const where: { type?: string; id?: string; content?: { not: null } } = { content: { not: null } };
  if (onlyType) where.type = onlyType;
  if (onlyId) where.id = onlyId;

  const acts = await prisma.legislativeAct.findMany({
    where,
    select: {
      id: true,
      type: true,
      fullNumber: true,
      content: true,
      ementa: true,
    },
    orderBy: [{ type: 'asc' }, { year: 'desc' }],
  });

  console.log(`📋 ${acts.length} atos com content\n`);

  const byCode = new Map<string, { count: number; samples: string[]; totalOccurrences: number }>();
  let cleanCount = 0;
  const dirty: { fullNumber: string; id: string; issues: Issue[]; content: string }[] = [];

  for (const a of acts) {
    if (!a.content) continue;
    const issues = diagnose(a.content);
    if (issues.length === 0) {
      cleanCount++;
      continue;
    }
    dirty.push({ fullNumber: a.fullNumber, id: a.id, issues, content: a.content });
    for (const i of issues) {
      const e = byCode.get(i.code) ?? { count: 0, samples: [], totalOccurrences: 0 };
      e.count++;
      e.totalOccurrences += i.count ?? 1;
      if (e.samples.length < 5) e.samples.push(a.fullNumber);
      byCode.set(i.code, e);
    }
  }

  console.log(`✅ ${cleanCount} contents sem problemas`);
  console.log(`⚠️  ${dirty.length} contents com problema(s)\n`);

  console.log(`📊 Por código (atos × ocorrências totais):`);
  const sorted = [...byCode.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [code, info] of sorted) {
    console.log(
      `   ${code.padEnd(22)} ${String(info.count).padStart(3)} atos / ${String(info.totalOccurrences).padStart(6)}× total → ${info.samples.slice(0, 3).join(', ')}`,
    );
  }

  if (showSamples) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 SAMPLES com mojibake/header/boiler:`);
    const targets = ['MOJIBAKE_FFFD', 'HEADER_PRESIDENCIA', 'BOILER_DOU_BRASAO', 'NAO_SUBSTITUI_DUP'];
    for (const t of targets) {
      const sample = dirty.find((d) => d.issues.some((i) => i.code === t));
      if (!sample) continue;
      console.log(`\n── [${t}] em ${sample.fullNumber} (${sample.id}) ──`);
      // Para mojibake, mostre primeira ocorrência
      if (t === 'MOJIBAKE_FFFD') {
        const idx = sample.content.indexOf('�');
        console.log(`   ...${JSON.stringify(sample.content.slice(Math.max(0, idx - 80), idx + 120))}...`);
      } else {
        console.log(`   ${JSON.stringify(sample.content.slice(0, 400))}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
