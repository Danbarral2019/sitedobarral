/**
 * Script para verificar e corrigir a distribuição de Orientações Normativas (ONs)
 * entre os cursos.
 *
 * Problema: Alguns cursos têm 40 ONs, outros 57 ONs.
 * Solução: Marcar todas as ONs como comuns (disponíveis em todos os cursos).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando distribuição de ONs...\n');

  // 1. Contar total de ONs
  const totalONs = await prisma.document.count({
    where: {
      category: 'orientacao-normativa'
    }
  });

  console.log(`📊 Total de ONs no banco: ${totalONs}`);

  // 2. Verificar distribuição por curso
  const onsByCourse = await prisma.document.groupBy({
    by: ['courseId', 'isCommon'],
    where: {
      category: 'orientacao-normativa'
    },
    _count: {
      id: true
    }
  });

  console.log('\n📋 Distribuição atual:');
  for (const group of onsByCourse) {
    const label = group.isCommon
      ? 'Comuns (todos os cursos)'
      : group.courseId || 'Sem curso';
    console.log(`  ${label}: ${group._count.id} ONs`);
  }

  // 3. Verificar duplicatas (mesma ON em diferentes cursos)
  const onsWithDetails = await prisma.document.findMany({
    where: {
      category: 'orientacao-normativa'
    },
    select: {
      id: true,
      title: true,
      onNumber: true,
      onYear: true,
      courseId: true,
      isCommon: true
    },
    orderBy: [
      { onYear: 'asc' },
      { onNumber: 'asc' }
    ]
  });

  // Agrupar por onNumber+onYear para detectar duplicatas
  const onsByNumber = new Map<string, typeof onsWithDetails>();

  for (const on of onsWithDetails) {
    if (on.onNumber && on.onYear) {
      const key = `${on.onNumber}-${on.onYear}`;
      if (!onsByNumber.has(key)) {
        onsByNumber.set(key, []);
      }
      onsByNumber.get(key)!.push(on);
    }
  }

  // Detectar duplicatas
  const duplicates = Array.from(onsByNumber.entries())
    .filter(([_, ons]) => ons.length > 1);

  if (duplicates.length > 0) {
    console.log(`\n⚠️  Encontradas ${duplicates.length} ONs duplicadas:`);
    for (const [key, ons] of duplicates) {
      console.log(`\n  ON ${key}:`);
      for (const on of ons) {
        console.log(`    - ID: ${on.id}, Curso: ${on.courseId || 'null'}, Comum: ${on.isCommon}`);
      }
    }
  } else {
    console.log('\n✅ Nenhuma ON duplicada encontrada');
  }

  // 4. Listar ONs únicas (por número)
  const uniqueONs = Array.from(onsByNumber.keys()).sort((a, b) => {
    const [numA, yearA] = a.split('-').map(Number);
    const [numB, yearB] = b.split('-').map(Number);
    return yearA !== yearB ? yearA - yearB : numA - numB;
  });

  console.log(`\n📝 Total de ONs únicas (por número): ${uniqueONs.length}`);
  console.log(`   Primeira: ON ${uniqueONs[0]}`);
  console.log(`   Última: ON ${uniqueONs[uniqueONs.length - 1]}`);

  // 5. Propor correção
  console.log('\n' + '='.repeat(60));
  console.log('💡 PROPOSTA DE CORREÇÃO:');
  console.log('='.repeat(60));

  if (duplicates.length > 0) {
    console.log(`\n1️⃣  Remover ${duplicates.length} ONs duplicadas`);
    console.log('    (manter apenas uma versão de cada ON)');
  }

  const commonONs = onsByCourse.find(g => g.isCommon)?._count.id || 0;
  const specificONs = totalONs - commonONs;

  if (specificONs > 0) {
    console.log(`\n2️⃣  Marcar ${specificONs} ONs como comuns`);
    console.log('    (para aparecerem em TODOS os cursos)');
  }

  console.log('\n' + '='.repeat(60));

  // 6. Perguntar se deve aplicar correções
  console.log('\n❓ Deseja aplicar as correções? (sim/não)');
  console.log('   Execute: npx tsx scripts/fix-ons-distribution.ts --apply');
}

async function applyFix() {
  console.log('🔧 Aplicando correções...\n');

  // 1. Encontrar e remover duplicatas (manter a primeira, remover as outras)
  const onsWithDetails = await prisma.document.findMany({
    where: {
      category: 'orientacao-normativa'
    },
    select: {
      id: true,
      title: true,
      onNumber: true,
      onYear: true,
      courseId: true,
      isCommon: true,
      uploadedAt: true
    },
    orderBy: [
      { onYear: 'asc' },
      { onNumber: 'asc' },
      { uploadedAt: 'asc' } // Manter a mais antiga
    ]
  });

  const onsByNumber = new Map<string, typeof onsWithDetails>();

  for (const on of onsWithDetails) {
    if (on.onNumber && on.onYear) {
      const key = `${on.onNumber}-${on.onYear}`;
      if (!onsByNumber.has(key)) {
        onsByNumber.set(key, []);
      }
      onsByNumber.get(key)!.push(on);
    }
  }

  // Coletar IDs para deletar (duplicatas)
  const idsToDelete: string[] = [];

  for (const [key, ons] of onsByNumber.entries()) {
    if (ons.length > 1) {
      // Manter a primeira (mais antiga), deletar o resto
      const toDelete = ons.slice(1);
      idsToDelete.push(...toDelete.map(on => on.id));
      console.log(`🗑️  ON ${key}: removendo ${toDelete.length} duplicata(s)`);
    }
  }

  if (idsToDelete.length > 0) {
    const deleted = await prisma.document.deleteMany({
      where: {
        id: {
          in: idsToDelete
        }
      }
    });
    console.log(`✅ ${deleted.count} ONs duplicadas removidas\n`);
  } else {
    console.log('✅ Nenhuma duplicata para remover\n');
  }

  // 2. Marcar todas as ONs restantes como comuns
  const updated = await prisma.document.updateMany({
    where: {
      category: 'orientacao-normativa'
    },
    data: {
      isCommon: true,
      courseId: null
    }
  });

  console.log(`✅ ${updated.count} ONs marcadas como comuns (disponíveis em todos os cursos)\n`);

  // 3. Verificar resultado final
  const finalCount = await prisma.document.count({
    where: {
      category: 'orientacao-normativa',
      isCommon: true
    }
  });

  console.log('='.repeat(60));
  console.log('✨ CORREÇÃO CONCLUÍDA!');
  console.log('='.repeat(60));
  console.log(`\n📊 Total de ONs: ${finalCount}`);
  console.log('📌 Todas as ONs agora aparecem em TODOS os cursos\n');
}

// Executar
const shouldApply = process.argv.includes('--apply');

if (shouldApply) {
  applyFix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
