/**
 * Script para verificar documentos duplicados no banco
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

import { prisma } from '../lib/prisma';

async function checkDuplicates() {
  try {
    console.log('='.repeat(80));
    console.log('ANÁLISE DE DOCUMENTOS DUPLICADOS');
    console.log('='.repeat(80));
    console.log('');

    // Contar total de documentos não revisados
    const unreviewedCount = await prisma.document.count({
      where: { reviewed: false }
    });

    console.log(`📊 Total de documentos não revisados: ${unreviewedCount}`);
    console.log('');

    // Contar documentos por categoria
    const byCategory = await prisma.document.groupBy({
      by: ['category'],
      where: { reviewed: false },
      _count: true
    });

    console.log('📁 Documentos por categoria:');
    byCategory.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count}`);
    });
    console.log('');

    // Buscar duplicatas de ONs
    const onDuplicates = await prisma.$queryRaw<any[]>`
      SELECT "onNumber", "onYear", COUNT(*) as count
      FROM "Document"
      WHERE "onNumber" IS NOT NULL
        AND "onYear" IS NOT NULL
        AND "reviewed" = false
      GROUP BY "onNumber", "onYear"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;

    if (onDuplicates.length > 0) {
      console.log('🔴 ONs DUPLICADAS (Top 10):');
      onDuplicates.forEach(dup => {
        console.log(`   ON ${dup.onNumber}/${dup.onYear}: ${dup.count} cópias`);
      });
      console.log('');
    }

    // Buscar duplicatas por título
    const titleDuplicates = await prisma.$queryRaw<any[]>`
      SELECT "title", COUNT(*) as count
      FROM "Document"
      WHERE "reviewed" = false
      GROUP BY "title"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;

    if (titleDuplicates.length > 0) {
      console.log('🔴 TÍTULOS DUPLICADOS (Top 10):');
      titleDuplicates.forEach(dup => {
        console.log(`   "${dup.title.substring(0, 60)}...": ${dup.count} cópias`);
      });
      console.log('');
    }

    // Últimos 10 documentos importados
    const recentDocs = await prisma.document.findMany({
      where: { reviewed: false },
      select: {
        id: true,
        title: true,
        onNumber: true,
        onYear: true,
        category: true,
        uploadedAt: true
      },
      orderBy: { uploadedAt: 'desc' },
      take: 10
    });

    console.log('📅 Últimos 10 documentos importados:');
    recentDocs.forEach(doc => {
      const id = doc.id.substring(0, 8);
      const on = doc.onNumber ? `ON ${doc.onNumber}/${doc.onYear}` : 'N/A';
      const date = doc.uploadedAt.toLocaleString('pt-BR');
      console.log(`   [${id}] ${on} | ${date}`);
      console.log(`       ${doc.title.substring(0, 70)}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
