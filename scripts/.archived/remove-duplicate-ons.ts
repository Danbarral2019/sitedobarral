/**
 * Script para remover ONs duplicadas
 *
 * Mantém apenas a cópia mais recente de cada ON (por onNumber + onYear)
 * Remove todas as outras cópias duplicadas
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

import { prisma } from '../lib/prisma';

interface DuplicateGroup {
  onNumber: number;
  onYear: number;
  count: number;
  ids: string[];
}

async function removeDuplicates(dryRun = true) {
  try {
    console.log('='.repeat(80));
    console.log('REMOÇÃO DE ONs DUPLICADAS');
    console.log('='.repeat(80));
    console.log('');

    if (dryRun) {
      console.log('⚠️  MODO DRY-RUN (nenhum dado será deletado)');
      console.log('   Execute com --execute para deletar de verdade');
      console.log('');
    } else {
      console.log('🔴 MODO EXECUÇÃO - DOCUMENTOS SERÃO DELETADOS!');
      console.log('');
    }

    // Buscar todos os documentos com onNumber e onYear
    const allONs = await prisma.document.findMany({
      where: {
        onNumber: { not: null },
        onYear: { not: null },
        category: 'orientacao-normativa'
      },
      select: {
        id: true,
        onNumber: true,
        onYear: true,
        uploadedAt: true,
        reviewed: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log(`📊 Total de ONs encontradas: ${allONs.length}`);
    console.log('');

    // Agrupar por onNumber + onYear
    const groups = new Map<string, DuplicateGroup>();

    for (const doc of allONs) {
      const key = `${doc.onNumber}-${doc.onYear}`;

      if (!groups.has(key)) {
        groups.set(key, {
          onNumber: doc.onNumber!,
          onYear: doc.onYear!,
          count: 0,
          ids: []
        });
      }

      const group = groups.get(key)!;
      group.count++;
      group.ids.push(doc.id);
    }

    // Filtrar apenas grupos com duplicatas
    const duplicates = Array.from(groups.values()).filter(g => g.count > 1);

    console.log(`🔍 ONs únicas: ${groups.size - duplicates.length}`);
    console.log(`🔴 ONs com duplicatas: ${duplicates.length}`);
    console.log('');

    if (duplicates.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada!');
      return;
    }

    // Contar documentos a serem removidos
    let totalToRemove = 0;
    for (const dup of duplicates) {
      totalToRemove += dup.count - 1; // Mantém 1, remove o resto
    }

    console.log(`📦 Total de documentos duplicados a remover: ${totalToRemove}`);
    console.log('');

    // Top 10 ONs mais duplicadas
    const top10 = duplicates
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.log('🔝 Top 10 ONs mais duplicadas:');
    top10.forEach((dup, idx) => {
      console.log(`   ${idx + 1}. ON ${dup.onNumber}/${dup.onYear}: ${dup.count} cópias`);
    });
    console.log('');

    if (!dryRun) {
      console.log('💾 Iniciando remoção de duplicatas...');
      console.log('');

      let removed = 0;
      let errors = 0;

      for (const dup of duplicates) {
        // Buscar todos os documentos desta ON ordenados por data
        const docs = await prisma.document.findMany({
          where: {
            onNumber: dup.onNumber,
            onYear: dup.onYear,
            category: 'orientacao-normativa'
          },
          orderBy: {
            uploadedAt: 'desc'
          }
        });

        // Manter o primeiro (mais recente), deletar o resto
        const toKeep = docs[0];
        const toDelete = docs.slice(1);

        console.log(`   ON ${dup.onNumber}/${dup.onYear}:`);
        console.log(`     ✅ Mantendo: ${toKeep.id.substring(0, 8)} (${toKeep.uploadedAt.toLocaleString('pt-BR')})`);

        for (const doc of toDelete) {
          try {
            await prisma.document.delete({
              where: { id: doc.id }
            });
            removed++;
            console.log(`     🗑️  Removido: ${doc.id.substring(0, 8)} (${doc.uploadedAt.toLocaleString('pt-BR')})`);
          } catch (error) {
            errors++;
            console.error(`     ❌ Erro ao remover ${doc.id}:`, error);
          }
        }
      }

      console.log('');
      console.log('='.repeat(80));
      console.log('✅ REMOÇÃO CONCLUÍDA');
      console.log('='.repeat(80));
      console.log(`Documentos removidos: ${removed}`);
      console.log(`Erros: ${errors}`);
      console.log('');

    } else {
      console.log('');
      console.log('ℹ️  Para executar a remoção, rode:');
      console.log('   export DATABASE_URL="..." && npx tsx scripts/remove-duplicate-ons.ts --execute');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const isExecute = process.argv.includes('--execute');
removeDuplicates(!isExecute)
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
