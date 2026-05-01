/**
 * Auditoria de tipografia/formatação da Lei 14.133 em data/lei-14133-artigos.ts
 *
 * Pendências documentadas em memória (2026-05-01):
 * - char unicode no art. 179
 * - anotações "Vide Decreto" soltas
 * - (VETADO) sem destaque
 * - linhas pontilhadas (sumários PDF)
 * - sufixos ALL CAPS
 *
 * Mais checks gerais alinhados com normalize.ts:
 * - mojibake U+FFFD
 * - NBSP residual
 * - zero-width chars
 * - HTML entities não decodificadas
 * - múltiplos espaços inline
 *
 * Read-only — só reporta. Não modifica o arquivo.
 */
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

interface Finding {
  numero: string;
  code: string;
  desc: string;
  sample?: string;
}

function diagnose(numero: string, ementa: string): Finding[] {
  const findings: Finding[] = [];
  const sliceAround = (idx: number, len = 60) =>
    JSON.stringify(ementa.slice(Math.max(0, idx - 30), idx + len));

  // 1. Mojibake
  const fffd = (ementa.match(/�/g) ?? []).length;
  if (fffd > 0) {
    const idx = ementa.indexOf('�');
    findings.push({ numero, code: 'MOJIBAKE_FFFD', desc: `${fffd}× U+FFFD`, sample: sliceAround(idx) });
  }

  // 2. NBSP inline
  const nbsp = (ementa.match(/ /g) ?? []).length;
  if (nbsp > 0) {
    const idx = ementa.indexOf(' ');
    findings.push({ numero, code: 'NBSP', desc: `${nbsp}× U+00A0`, sample: sliceAround(idx) });
  }

  // 3. Zero-width chars
  const zw = (ementa.match(/[​‌‍﻿⁠]/g) ?? []).length;
  if (zw > 0) findings.push({ numero, code: 'ZERO_WIDTH', desc: `${zw}× zero-width` });

  // 4. HTML entities
  if (/&(?:nbsp|amp|lt|gt|quot|#\d+);/.test(ementa)) {
    findings.push({ numero, code: 'HTML_ENTITIES', desc: 'tem HTML entities (&nbsp;/&amp;/...)' });
  }

  // 5. Tags HTML canônicas (não confundir com placeholders <campo>)
  const htmlTagPattern = /<\/?(?:br|p|div|span|a|strong|em|b|i|u|table|tr|td|th|ul|ol|li|h[1-6]|font|hr)(?:\s[^>]*)?>/i;
  if (htmlTagPattern.test(ementa)) findings.push({ numero, code: 'HTML_TAGS', desc: 'tem tags HTML canônicas' });

  // 6. Múltiplos espaços inline (3+)
  const multiSpace = (ementa.match(/   +/g) ?? []).length;
  if (multiSpace > 0) {
    const idx = ementa.search(/   +/);
    findings.push({ numero, code: 'MULTI_SPACE', desc: `${multiSpace}× run de 3+ espaços`, sample: sliceAround(idx) });
  }

  // 7. (VETADO) sem destaque (sinaliza pra UI consertar — não é bug do dado)
  const vetado = (ementa.match(/\(VETADO\)/g) ?? []).length;
  if (vetado > 0) {
    const idx = ementa.indexOf('(VETADO)');
    findings.push({ numero, code: 'VETADO', desc: `${vetado}× "(VETADO)"`, sample: sliceAround(idx) });
  }

  // 8. "Vide Decreto/Lei/Regulamento" anotações soltas
  const videLines = ementa.split('\n').filter((l) => /^\s*\(?Vide\s+(Decreto|Lei|Medida Provisória|Emenda|Regulamento)/i.test(l.trim()));
  if (videLines.length > 0) {
    findings.push({ numero, code: 'VIDE_NOTE', desc: `${videLines.length}× "Vide ..."`, sample: JSON.stringify(videLines[0].slice(0, 80)) });
  }

  // 9. Linhas pontilhadas (4+ pontos seguidos — sumário PDF ou separador)
  const dots = (ementa.match(/\.{4,}/g) ?? []).length;
  if (dots > 0) {
    const idx = ementa.search(/\.{4,}/);
    findings.push({ numero, code: 'DOTS', desc: `${dots}× run de 4+ pontos`, sample: sliceAround(idx) });
  }

  // 10. Sufixos ALL CAPS no fim de parágrafo (sinal de header de bloco que vazou)
  // Ex: "...e dá outras providências.PRESIDÊNCIA DA REPÚBLICA"
  const allCapsSuffix = ementa.match(/[a-záéíóúâêôãõç][A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}/);
  if (allCapsSuffix) {
    const idx = ementa.indexOf(allCapsSuffix[0]);
    findings.push({ numero, code: 'ALL_CAPS_SUFFIX', desc: 'palavra ALL CAPS colada após lowercase', sample: sliceAround(idx, 80) });
  }

  // 11. Aspas "smart" (curly) inconsistentes: " " em vez de ASCII " " em texto legal
  // (não é "bug" mas inconsistência tipográfica — flag baixo nível)
  // Skip pra não poluir.

  // 12. Trailing whitespace nas bordas
  if (ementa !== ementa.trim()) {
    findings.push({ numero, code: 'EDGES', desc: 'whitespace nas bordas' });
  }

  // 13. Linha vazia entre parágrafos: ementa usa `\n\n` mas runs > 2 é problema
  if (/\n{3,}/.test(ementa)) {
    findings.push({ numero, code: 'MULTI_NEWLINE', desc: '3+ \\n consecutivos' });
  }

  return findings;
}

async function main() {
  const articles = Object.values(LEI_14133_ARTIGOS);
  console.log(`📋 Auditando ${articles.length} artigos da Lei 14.133\n`);

  const allFindings: Finding[] = [];
  for (const a of articles) {
    allFindings.push(...diagnose(a.numero, a.ementa));
  }

  // Agrega por código
  const byCode = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const arr = byCode.get(f.code) ?? [];
    arr.push(f);
    byCode.set(f.code, arr);
  }

  console.log(`📊 Resumo (${allFindings.length} findings em ${new Set(allFindings.map((f) => f.numero)).size} artigos):\n`);
  const sorted = [...byCode.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [code, items] of sorted) {
    const arts = [...new Set(items.map((i) => i.numero))];
    console.log(`   ${code.padEnd(20)} ${String(items.length).padStart(4)}× em ${arts.length} arts → ${arts.slice(0, 6).join(', ')}${arts.length > 6 ? `... +${arts.length - 6}` : ''}`);
  }

  // Detalhe — primeiros 3 samples por code
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📝 SAMPLES por code:`);
  for (const [code, items] of sorted) {
    console.log(`\n[${code}] (${items.length} total):`);
    for (const i of items.slice(0, 3)) {
      console.log(`   art ${i.numero}: ${i.desc}`);
      if (i.sample) console.log(`     ${i.sample}`);
    }
    if (items.length > 3) console.log(`   ... +${items.length - 3} outros`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
