/**
 * Remove duplicatas reais de documentos (mesmo título + url → mesmo slug),
 * mantendo um registro por grupo (o primeiro por id, igual ao que o export
 * preserva). Faz BACKUP completo antes de qualquer exclusão.
 *
 * Uso:
 *   npx tsx scripts/dedupe-documents.ts            # backup + simulação (não apaga)
 *   npx tsx scripts/dedupe-documents.ts --apply    # backup + exclusão efetiva
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { mkdirSync, writeFileSync } from 'fs';

import { EXPORT_DOC_SELECT, documentSlug } from '../lib/obsidian/export';

const APPLY = process.argv.includes('--apply');
const STAMP = '2026-06-18';
const BACKUP_DIR = 'C:/Users/User/projetos/sitedobarral/backups';
const norm = (s: string | null | undefined) => (s ?? '').trim();

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaNeon } = await import('@prisma/adapter-neon');
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

  try {
    // 1) Identificar grupos de duplicatas e ids a remover
    const docs = await prisma.document.findMany({ select: EXPORT_DOC_SELECT });
    const groups = new Map<string, any[]>();
    for (const d of docs) {
      const k = documentSlug(d as any);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(d);
    }
    const deleteIds: string[] = [];
    const keepIds: string[] = [];
    for (const [, v] of groups) {
      if (v.length < 2) continue;
      const sameTitle = new Set(v.map((x) => norm(x.title))).size === 1;
      const sameUrl = new Set(v.map((x) => norm(x.url))).size === 1;
      if (!sameTitle || !sameUrl) continue; // só duplicatas idênticas
      const sorted = [...v].sort((a, b) => a.id.localeCompare(b.id));
      keepIds.push(sorted[0].id);
      for (const d of sorted.slice(1)) deleteIds.push(d.id);
    }

    console.log(`Grupos de duplicatas: ${keepIds.length} | a remover: ${deleteIds.length} | modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    if (deleteIds.length === 0) return;

    // 2) BACKUP completo das linhas afetadas (exceto embeddings de chunk, regeneráveis)
    const where = { documentId: { in: deleteIds } };
    const backup = {
      generatedAt: new Date().toISOString(),
      deleteIds,
      documents: await prisma.document.findMany({ where: { id: { in: deleteIds } } }),
      documentVersions: await prisma.documentVersion.findMany({ where }),
      documentMetaTcu: await prisma.documentMetaTcu.findMany({ where }),
      documentMetaDou: await prisma.documentMetaDou.findMany({ where }),
      documentNotes: await prisma.documentNotes.findMany({ where }),
      clippingItemExtract: await prisma.clippingItemExtract.findMany({ where }),
      lessonDocuments: await prisma.lessonDocument.findMany({ where }),
      tcuHighlights: await prisma.tcuHighlight.findMany({ where }),
      favorites: await prisma.favorite.findMany({ where }),
      chunkCount: await prisma.documentChunk.count({ where }),
    };
    mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = `${BACKUP_DIR}/dedupe-documents-${STAMP}.json`;
    writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
    console.log(`Backup gravado: ${backupPath}`);
    console.log(`  documents=${backup.documents.length} versions=${backup.documentVersions.length} notes=${backup.documentNotes.length} metaTcu=${backup.documentMetaTcu.length} metaDou=${backup.documentMetaDou.length} clipping=${backup.clippingItemExtract.length} lessonDocs=${backup.lessonDocuments.length} highlights=${backup.tcuHighlights.length} favorites=${backup.favorites.length} chunks=${backup.chunkCount}`);

    if (!APPLY) {
      console.log('DRY-RUN: nada foi apagado. Rode com --apply para efetivar.');
      return;
    }

    // 3) Exclusão explícita das filhas (ordem correta) + documentos, em transação
    await prisma.$transaction([
      prisma.documentChunk.deleteMany({ where }),
      prisma.documentVersion.deleteMany({ where }),
      prisma.documentMetaTcu.deleteMany({ where }),
      prisma.documentMetaDou.deleteMany({ where }),
      prisma.documentNotes.deleteMany({ where }),
      prisma.clippingItemExtract.deleteMany({ where }),
      prisma.lessonDocument.deleteMany({ where }),
      prisma.tcuHighlight.deleteMany({ where }),
      prisma.favorite.updateMany({ where, data: { documentId: null } }),
      prisma.document.deleteMany({ where: { id: { in: deleteIds } } }),
    ]);

    const remaining = await prisma.document.count();
    console.log(`Exclusão concluída. Documentos restantes no banco: ${remaining}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
