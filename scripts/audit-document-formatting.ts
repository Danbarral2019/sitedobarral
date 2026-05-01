/**
 * Auditoria de formatação dos Documents (AGU pareceres, TCU informativos/
 * acórdãos, ON SEGES, súmulas, manuais — toda a base de conhecimento que
 * não é LegislativeAct).
 *
 * Replica os checks de inspect-content-formatting.ts mas adaptados pra
 * model Document (campos: title, description, content).
 *
 * Read-only — só reporta. Agrupa por category pra priorização.
 */
import { prisma } from '../lib/prisma';

interface Issue {
  code: string;
  count?: number;
}

function diagnose(text: string | null): Issue[] {
  if (!text) return [];
  const issues: Issue[] = [];

  // Mojibake U+FFFD
  const fffd = (text.match(/�/g) ?? []).length;
  if (fffd > 0) issues.push({ code: 'MOJIBAKE_FFFD', count: fffd });

  // NBSP inline
  const nbsp = (text.match(/ /g) ?? []).length;
  if (nbsp > 0) issues.push({ code: 'NBSP', count: nbsp });

  // Zero-width
  const zw = (text.match(/[​‌‍﻿⁠]/g) ?? []).length;
  if (zw > 0) issues.push({ code: 'ZERO_WIDTH', count: zw });

  // HTML entities
  if (/&(?:nbsp|amp|lt|gt|quot|#\d+);/.test(text)) issues.push({ code: 'HTML_ENTITIES' });

  // HTML tags canônicos (não confundir com placeholders <campo>)
  const htmlTagPattern = /<\/?(?:br|p|div|span|a|strong|em|b|i|u|table|tr|td|th|ul|ol|li|h[1-6]|font|hr)(?:\s[^>]*)?>/i;
  if (htmlTagPattern.test(text)) issues.push({ code: 'HTML_TAGS' });

  // Header institucional vazado
  if (/^Presid[êe]ncia da Rep[úu]blica\s*$/m.test(text)) issues.push({ code: 'HEADER_PRESIDENCIA' });
  if (/^Casa Civil\s*$/m.test(text)) issues.push({ code: 'HEADER_CASA_CIVIL' });
  if (/^Subchefia para Assuntos/m.test(text)) issues.push({ code: 'HEADER_SUBCHEFIA' });

  // gov.br/DOU boilerplate
  if (/Brasão do Brasil/.test(text)) issues.push({ code: 'BOILER_DOU' });
  if (/Compartilhe\s*:/i.test(text)) issues.push({ code: 'BOILER_SHARE' });
  if (/^link para Copiar/m.test(text)) issues.push({ code: 'BOILER_COPIAR' });
  if (
    /Publicado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) &&
    /Modificado em\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)
  ) issues.push({ code: 'BOILER_GOVBR_INLINE' });

  // CRLF
  if (/\r/.test(text)) issues.push({ code: 'CR' });

  // 3+ espaços inline (run de whitespace excessivo)
  const multiSpace = (text.match(/[ \t]{3,}/g) ?? []).length;
  if (multiSpace > 5) issues.push({ code: 'MULTI_SPACE', count: multiSpace });

  // 3+ \n (parágrafo vazio em excesso)
  if (/\n{3,}/.test(text)) issues.push({ code: 'MULTI_NEWLINE' });

  return issues;
}

interface DocStats {
  total: number;
  withTitleProb: number;
  withDescProb: number;
  withContentProb: number;
  byCode: Map<string, { count: number; field: Set<string>; samples: Set<string> }>;
}

async function main() {
  const onlyCategory = process.argv.find((a) => a.startsWith('--category='))?.split('=')[1];
  const showSamples = process.argv.includes('--samples');

  const where = onlyCategory ? { category: onlyCategory } : {};
  const docs = await prisma.document.findMany({
    where,
    select: { id: true, title: true, description: true, content: true, category: true, issuerOrg: true },
  });

  console.log(`📋 ${docs.length} documents${onlyCategory ? ` na categoria ${onlyCategory}` : ''}\n`);

  // Por categoria
  const byCategoryStats = new Map<string, DocStats>();
  const ensureStats = (cat: string): DocStats => {
    let s = byCategoryStats.get(cat);
    if (!s) {
      s = { total: 0, withTitleProb: 0, withDescProb: 0, withContentProb: 0, byCode: new Map() };
      byCategoryStats.set(cat, s);
    }
    return s;
  };

  for (const d of docs) {
    const s = ensureStats(d.category);
    s.total++;
    const titleIssues = diagnose(d.title);
    const descIssues = diagnose(d.description);
    const contentIssues = diagnose(d.content);
    if (titleIssues.length > 0) s.withTitleProb++;
    if (descIssues.length > 0) s.withDescProb++;
    if (contentIssues.length > 0) s.withContentProb++;
    for (const [field, issues] of [['title', titleIssues], ['description', descIssues], ['content', contentIssues]] as const) {
      for (const i of issues) {
        const e = s.byCode.get(i.code) ?? { count: 0, field: new Set<string>(), samples: new Set<string>() };
        e.count += (i.count ?? 1);
        e.field.add(field);
        if (e.samples.size < 3) e.samples.add(d.title.slice(0, 60));
        s.byCode.set(i.code, e);
      }
    }
  }

  console.log(`📊 Por categoria:\n`);
  const sortedCats = [...byCategoryStats.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [cat, s] of sortedCats) {
    if (s.byCode.size === 0) {
      console.log(`✅ ${cat.padEnd(30)} ${s.total} docs — sem problemas`);
      continue;
    }
    console.log(`\n📁 ${cat} (${s.total} docs):`);
    console.log(`   Com problema em title: ${s.withTitleProb}, description: ${s.withDescProb}, content: ${s.withContentProb}`);
    const sortedCodes = [...s.byCode.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [code, info] of sortedCodes) {
      const fields = [...info.field].join('+');
      console.log(`   - ${code.padEnd(22)} ${String(info.count).padStart(6)}× em ${fields}`);
    }
  }

  if (showSamples) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 Samples por categoria/code:`);
    for (const [cat, s] of sortedCats) {
      for (const [code, info] of s.byCode) {
        console.log(`\n[${cat} / ${code}]:`);
        const samples = await prisma.document.findMany({
          where: { category: cat, ...buildWhereForCode(code) },
          select: { title: true, content: true },
          take: 2,
        });
        for (const d of samples) {
          const text = d.content ?? d.title ?? '';
          const matches = findFirstMatchForCode(text, code);
          console.log(`  ${d.title.slice(0, 60)}`);
          if (matches) console.log(`    → ${matches}`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

function buildWhereForCode(code: string): Record<string, unknown> {
  // Construct a `where` clause that reliably finds documents matching `code`.
  // Imperfeito (full-text search would need raw SQL); fallback é só exemplo.
  switch (code) {
    case 'MOJIBAKE_FFFD':
      return { content: { contains: '�' } };
    case 'BOILER_SHARE':
      return { content: { contains: 'Compartilhe' } };
    case 'CR':
      return { content: { contains: '\r' } };
    default:
      return {};
  }
}

function findFirstMatchForCode(text: string, code: string): string | null {
  switch (code) {
    case 'MOJIBAKE_FFFD':
      const i = text.indexOf('�');
      return i >= 0 ? JSON.stringify(text.slice(Math.max(0, i - 30), i + 60)) : null;
    case 'NBSP':
      const j = text.indexOf(' ');
      return j >= 0 ? JSON.stringify(text.slice(Math.max(0, j - 30), j + 60)) : null;
    case 'BOILER_SHARE':
      const k = text.search(/Compartilhe\s*:/i);
      return k >= 0 ? JSON.stringify(text.slice(Math.max(0, k - 30), k + 60)) : null;
    default:
      return null;
  }
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
