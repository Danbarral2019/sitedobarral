/**
 * Audit Slug Collisions — DB vs Obsidian Vault
 * Uso: npx tsx scripts/audit-slug-collisions.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFileSync } from 'fs';

import {
  EXPORT_DOC_SELECT,
  EXPORT_DECISION_SELECT,
  EXPORT_DECISION_WHERE,
  documentSlug,
  decisionSlug,
} from '../lib/obsidian/export';

const OUT = 'C:/Users/User/projetos/Cofre do obsidian/colisoes_slug_auditoria_2026-06-18.md';

function group<T>(items: T[], keyOf: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

// Um grupo é "duplicata real" se todos os membros têm o mesmo título e a mesma URL.
function isDuplicate(v: any[], titleOf: (x: any) => string, urlOf: (x: any) => string | null): boolean {
  const t = new Set(v.map((x) => (titleOf(x) || '').trim()));
  const u = new Set(v.map((x) => (urlOf(x) || '').trim()));
  return t.size === 1 && u.size === 1;
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaNeon } = await import('@prisma/adapter-neon');
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

  try {
    const docs = await prisma.document.findMany({ select: EXPORT_DOC_SELECT });
    const decs = await prisma.tribunalDecision.findMany({
      where: EXPORT_DECISION_WHERE,
      select: EXPORT_DECISION_SELECT,
    });

    const docColl = [...group(docs, (d) => documentSlug(d as any)).entries()].filter(([, v]) => v.length > 1);
    const decColl = [...group(decs, (d) => decisionSlug(d as any)).entries()].filter(([, v]) => v.length > 1);

    const docDup = docColl.filter(([, v]) => isDuplicate(v, (x) => x.title, (x) => x.url));
    const docDist = docColl.filter(([, v]) => !isDuplicate(v, (x) => x.title, (x) => x.url));
    const decDup = decColl.filter(([, v]) => isDuplicate(v, (x) => x.title, (x) => x.url));
    const decDist = decColl.filter(([, v]) => !isDuplicate(v, (x) => x.title, (x) => x.url));

    const lost = (g: [string, any[]][]) => g.reduce((a, [, v]) => a + v.length - 1, 0);

    console.log('=== Auditoria de colisoes de slug ===');
    console.log(`Documentos: ${docs.length} no banco | colisoes ${docColl.length} | perdidos ${lost(docColl)} (duplicata ${lost(docDup)} / distintos ${lost(docDist)})`);
    console.log(`Decisoes: ${decs.length} no banco | colisoes ${decColl.length} | perdidos ${lost(decColl)} (duplicata ${lost(decDup)} / distintos ${lost(decDist)})`);

    const L: string[] = [];
    L.push('# Auditoria de colisões de slug — Cofre Obsidian');
    L.push('');
    L.push('Gerado em 18/06/2026 a partir do banco de produção (sitedobarral). Um grupo é classificado como "duplicata real" quando todos os registros têm título e URL idênticos (export corretamente colapsa); como "registros distintos" quando diferem (perda real de conteúdo no cofre).');
    L.push('');
    L.push('## Resumo');
    L.push('');
    L.push('| Coleção | No banco | Grupos em colisão | Sem nota (total) | Por duplicata | Por registros distintos |');
    L.push('|---|---|---|---|---|---|');
    L.push(`| Documentos | ${docs.length} | ${docColl.length} | ${lost(docColl)} | ${lost(docDup)} | ${lost(docDist)} |`);
    L.push(`| Decisões | ${decs.length} | ${decColl.length} | ${lost(decColl)} | ${lost(decDup)} | ${lost(decDist)} |`);
    L.push('');

    const dump = (title: string, groups: [string, any[]][], line: (d: any) => string) => {
      L.push(`## ${title} (${groups.length} grupos)`);
      L.push('');
      for (const [slug, v] of groups.sort((a, b) => b[1].length - a[1].length)) {
        L.push(`### ${slug} (${v.length} registros)`);
        for (const d of v as any[]) L.push(line(d));
        L.push('');
      }
    };

    const decLine = (d: any) => `- id=\`${d.id}\` · ${d.tribunalCode}/${d.decisionType} nº ${d.decisionNumber} · ano ${d.year} · "${d.title}" · ${d.url ?? 's/url'}`;
    const docLine = (d: any) => `- id=\`${d.id}\` · cat=${d.category} · "${d.title}" · ${d.url ?? 's/url'}`;

    dump('Decisões — REGISTROS DISTINTOS (perda real)', decDist, decLine);
    dump('Documentos — REGISTROS DISTINTOS (perda real)', docDist, docLine);
    dump('Decisões — duplicatas reais (colapso correto)', decDup, decLine);
    dump('Documentos — duplicatas reais (colapso correto)', docDup, docLine);

    writeFileSync(OUT, L.join('\n'), 'utf-8');
    console.log(`\nRelatorio gravado em: ${OUT}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
