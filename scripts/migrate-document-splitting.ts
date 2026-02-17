/**
 * Script de migração: Document Vertical Table Splitting
 *
 * Copia dados dos campos TCU, DOU e Notes do Document para tabelas satélite 1:1.
 * As colunas originais NÃO são removidas (isso será feito em sessão futura).
 *
 * Usage:
 *   npx tsx scripts/migrate-document-splitting.ts --dry-run   # Preview
 *   npx tsx scripts/migrate-document-splitting.ts              # Executa
 *   npx tsx scripts/migrate-document-splitting.ts --verify     # Valida
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const isVerify = process.argv.includes('--verify');

async function migrateTCU() {
  console.log('\n--- Migrando dados TCU ---');

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { tcuNumeroAcordao: { not: null } },
        { tcuAutorTese: { not: null } },
        { tcuArea: { not: null } },
        { tcuEnriquecimentoStatus: { not: null } },
        { tcuRelator: { not: null } },
      ],
    },
    select: {
      id: true,
      tcuNumeroAcordao: true,
      tcuAutorTese: true,
      tcuArea: true,
      tcuTema: true,
      tcuSubtema: true,
      tcuLegislacao: true,
      tcuIndexadores: true,
      tcuTipoProcesso: true,
      tcuDataJulgamento: true,
      tcuLinkPDF: true,
      tcuEmentaCompleta: true,
      tcuTextoCompleto: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuEnriquecidoEm: true,
      tcuEnriquecimentoStatus: true,
      tcuEnriquecimentoErro: true,
      tcuClassificadoEm: true,
      tcuRevisadoPorAdmin: true,
    },
  });

  console.log(`  Encontrados ${documents.length} documentos com dados TCU`);

  if (isDryRun) return documents.length;

  let created = 0;
  let skipped = 0;

  for (const doc of documents) {
    // Verifica se já existe registro satélite
    const existing = await prisma.documentMetaTcu.findUnique({
      where: { documentId: doc.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.documentMetaTcu.create({
      data: {
        documentId: doc.id,
        numeroAcordao: doc.tcuNumeroAcordao,
        autorTese: doc.tcuAutorTese,
        area: doc.tcuArea,
        tema: doc.tcuTema,
        subtema: doc.tcuSubtema,
        legislacao: doc.tcuLegislacao,
        indexadores: doc.tcuIndexadores,
        tipoProcesso: doc.tcuTipoProcesso,
        dataJulgamento: doc.tcuDataJulgamento,
        linkPDF: doc.tcuLinkPDF,
        ementaCompleta: doc.tcuEmentaCompleta,
        textoCompleto: doc.tcuTextoCompleto,
        relator: doc.tcuRelator,
        orgaoJulgador: doc.tcuOrgaoJulgador,
        enriquecidoEm: doc.tcuEnriquecidoEm,
        enriquecimentoStatus: doc.tcuEnriquecimentoStatus,
        enriquecimentoErro: doc.tcuEnriquecimentoErro,
        classificadoEm: doc.tcuClassificadoEm,
        revisadoPorAdmin: doc.tcuRevisadoPorAdmin,
      },
    });
    created++;
  }

  console.log(`  Criados: ${created}, Já existentes: ${skipped}`);
  return created;
}

async function migrateDOU() {
  console.log('\n--- Migrando dados DOU ---');

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { douUrl: { not: null } },
        { douData: { not: null } },
        { douSecao: { not: null } },
      ],
    },
    select: {
      id: true,
      douUrl: true,
      douData: true,
      douSecao: true,
      douPagina: true,
      douEdicao: true,
    },
  });

  console.log(`  Encontrados ${documents.length} documentos com dados DOU`);

  if (isDryRun) return documents.length;

  let created = 0;
  let skipped = 0;

  for (const doc of documents) {
    const existing = await prisma.documentMetaDou.findUnique({
      where: { documentId: doc.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.documentMetaDou.create({
      data: {
        documentId: doc.id,
        url: doc.douUrl,
        data: doc.douData,
        secao: doc.douSecao,
        pagina: doc.douPagina,
        edicao: doc.douEdicao,
      },
    });
    created++;
  }

  console.log(`  Criados: ${created}, Já existentes: ${skipped}`);
  return created;
}

async function migrateNotes() {
  console.log('\n--- Migrando dados Notes ---');

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { adminNotes: { not: null } },
        { publicNotes: { not: null } },
        { notesImportance: { not: null } },
        { notesPracticalUse: { not: null } },
        { notesKeyPoints: { not: null } },
      ],
    },
    select: {
      id: true,
      adminNotes: true,
      publicNotes: true,
      notesImportance: true,
      notesRelatedDocs: true,
      notesPracticalUse: true,
      notesKeyPoints: true,
      notesUpdatedAt: true,
      notesUpdatedBy: true,
    },
  });

  console.log(`  Encontrados ${documents.length} documentos com dados Notes`);

  if (isDryRun) return documents.length;

  let created = 0;
  let skipped = 0;

  for (const doc of documents) {
    const existing = await prisma.documentNotes.findUnique({
      where: { documentId: doc.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.documentNotes.create({
      data: {
        documentId: doc.id,
        adminNotes: doc.adminNotes,
        publicNotes: doc.publicNotes,
        importance: doc.notesImportance,
        relatedDocs: doc.notesRelatedDocs,
        practicalUse: doc.notesPracticalUse,
        keyPoints: doc.notesKeyPoints,
        updatedAt: doc.notesUpdatedAt,
        updatedBy: doc.notesUpdatedBy,
      },
    });
    created++;
  }

  console.log(`  Criados: ${created}, Já existentes: ${skipped}`);
  return created;
}

async function verify() {
  console.log('\n=== VERIFICAÇÃO ===\n');

  // Verificar TCU
  const tcuSatellites = await prisma.documentMetaTcu.count();
  const tcuDocuments = await prisma.document.count({
    where: {
      OR: [
        { tcuNumeroAcordao: { not: null } },
        { tcuAutorTese: { not: null } },
        { tcuArea: { not: null } },
        { tcuEnriquecimentoStatus: { not: null } },
        { tcuRelator: { not: null } },
      ],
    },
  });
  const tcuMatch = tcuSatellites === tcuDocuments;
  console.log(`TCU: ${tcuSatellites} satélites vs ${tcuDocuments} documentos — ${tcuMatch ? 'OK' : 'DIVERGÊNCIA!'}`);

  // Verificar DOU
  const douSatellites = await prisma.documentMetaDou.count();
  const douDocuments = await prisma.document.count({
    where: {
      OR: [
        { douUrl: { not: null } },
        { douData: { not: null } },
        { douSecao: { not: null } },
      ],
    },
  });
  const douMatch = douSatellites === douDocuments;
  console.log(`DOU: ${douSatellites} satélites vs ${douDocuments} documentos — ${douMatch ? 'OK' : 'DIVERGÊNCIA!'}`);

  // Verificar Notes
  const notesSatellites = await prisma.documentNotes.count();
  const notesDocuments = await prisma.document.count({
    where: {
      OR: [
        { adminNotes: { not: null } },
        { publicNotes: { not: null } },
        { notesImportance: { not: null } },
        { notesPracticalUse: { not: null } },
        { notesKeyPoints: { not: null } },
      ],
    },
  });
  const notesMatch = notesSatellites === notesDocuments;
  console.log(`Notes: ${notesSatellites} satélites vs ${notesDocuments} documentos — ${notesMatch ? 'OK' : 'DIVERGÊNCIA!'}`);

  // Spot check: verificar alguns registros
  console.log('\n--- Spot check TCU ---');
  const sampleTcu = await prisma.documentMetaTcu.findFirst({
    where: { numeroAcordao: { not: null } },
    include: { document: { select: { id: true, tcuNumeroAcordao: true } } },
  });
  if (sampleTcu) {
    const match = sampleTcu.numeroAcordao === sampleTcu.document.tcuNumeroAcordao;
    console.log(`  Amostra: metaTcu.numeroAcordao="${sampleTcu.numeroAcordao}" vs document.tcuNumeroAcordao="${sampleTcu.document.tcuNumeroAcordao}" — ${match ? 'OK' : 'DIVERGÊNCIA!'}`);
  }

  console.log('\n--- Spot check DOU ---');
  const sampleDou = await prisma.documentMetaDou.findFirst({
    where: { url: { not: null } },
    include: { document: { select: { id: true, douUrl: true } } },
  });
  if (sampleDou) {
    const match = sampleDou.url === sampleDou.document.douUrl;
    console.log(`  Amostra: metaDou.url="${sampleDou.url?.slice(0, 60)}..." vs document.douUrl="${sampleDou.document.douUrl?.slice(0, 60)}..." — ${match ? 'OK' : 'DIVERGÊNCIA!'}`);
  }

  console.log('\n--- Spot check Notes ---');
  const sampleNotes = await prisma.documentNotes.findFirst({
    where: { adminNotes: { not: null } },
    include: { document: { select: { id: true, adminNotes: true } } },
  });
  if (sampleNotes) {
    const match = sampleNotes.adminNotes === sampleNotes.document.adminNotes;
    console.log(`  Amostra: notes.adminNotes="${sampleNotes.adminNotes?.slice(0, 60)}..." vs document.adminNotes="${sampleNotes.document.adminNotes?.slice(0, 60)}..." — ${match ? 'OK' : 'DIVERGÊNCIA!'}`);
  }

  const allMatch = tcuMatch && douMatch && notesMatch;
  console.log(`\n=== Resultado: ${allMatch ? 'TUDO OK' : 'DIVERGÊNCIAS DETECTADAS!'} ===\n`);

  return allMatch;
}

async function main() {
  console.log('=== Document Vertical Table Splitting — Migração de Dados ===');
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (apenas contagem)' : isVerify ? 'VERIFICAÇÃO' : 'EXECUÇÃO'}\n`);

  try {
    if (isVerify) {
      const ok = await verify();
      process.exit(ok ? 0 : 1);
    }

    const tcuCount = await migrateTCU();
    const douCount = await migrateDOU();
    const notesCount = await migrateNotes();

    console.log('\n=== Resumo ===');
    console.log(`  TCU: ${tcuCount} registros`);
    console.log(`  DOU: ${douCount} registros`);
    console.log(`  Notes: ${notesCount} registros`);

    if (isDryRun) {
      console.log('\n(Dry-run: nenhum dado foi modificado)');
    } else {
      console.log('\nMigração concluída! Execute com --verify para validar.');
    }
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
