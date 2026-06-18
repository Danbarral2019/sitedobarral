/**
 * Lista duplicatas reais de documentos (mesmo título + mesma url) que geram o
 * mesmo slug. Para cada grupo, marca um registro a MANTER (o mesmo que o export
 * preserva: primeiro por id) e os demais como candidatos a remover.
 * NÃO altera o banco. Uso: npx tsx scripts/list-document-duplicates.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFileSync } from 'fs';

import { EXPORT_DOC_SELECT, documentSlug } from '../lib/obsidian/export';

const OUT = 'C:/Users/User/projetos/Cofre do obsidian/duplicatas_documentos_2026-06-18.md';
const norm = (s: string | null | undefined) => (s ?? '').trim();

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaNeon } = await import('@prisma/adapter-neon');
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

  try {
    const docs = await prisma.document.findMany({ select: EXPORT_DOC_SELECT });

    const groups = new Map<string, any[]>();
    for (const d of docs) {
      const k = documentSlug(d as any);
      const arr = groups.get(k);
      if (arr) arr.push(d);
      else groups.set(k, [d]);
    }

    const dupGroups = [...groups.entries()]
      .filter(([, v]) => v.length > 1)
      .filter(([, v]) => new Set(v.map((x) => norm(x.title))).size === 1 && new Set(v.map((x) => norm(x.url))).size === 1)
      .sort((a, b) => b[1].length - a[1].length);

    let toDelete = 0;
    const L: string[] = [];
    L.push('# Duplicatas de documentos (mesmo título e URL) — validação');
    L.push('');
    L.push('Gerado em 18/06/2026 a partir do banco de produção (sitedobarral). Cada grupo tem registros idênticos no título e na URL. Sugere-se MANTER um e remover os demais. O id a manter é o que o export já preserva (primeiro por ordem de id). Nada foi alterado no banco.');
    L.push('');

    for (const [slug, v] of dupGroups) {
      const sorted = [...v].sort((a, b) => a.id.localeCompare(b.id));
      const keep = sorted[0];
      const del = sorted.slice(1);
      toDelete += del.length;
      L.push(`### ${slug} (${v.length} registros · remover ${del.length})`);
      L.push(`- MANTER  id=\`${keep.id}\` · cat=${keep.category} · ${keep.url ?? 's/url'}`);
      for (const d of del) L.push(`- remover id=\`${d.id}\` · cat=${d.category}`);
      L.push('');
    }

    const header = [
      '## Resumo',
      '',
      `Grupos de duplicatas: ${dupGroups.length}`,
      `Registros a manter: ${dupGroups.length}`,
      `Registros candidatos a remover: ${toDelete}`,
      '',
    ];
    L.splice(4, 0, ...header);

    writeFileSync(OUT, L.join('\n'), 'utf-8');
    console.log(`Grupos de duplicatas: ${dupGroups.length} | candidatos a remover: ${toDelete}`);
    console.log(`Relatorio gravado em: ${OUT}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
