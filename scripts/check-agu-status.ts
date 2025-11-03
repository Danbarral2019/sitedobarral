/**
 * Script para verificar status de todos os scrapers AGU
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

import { prisma } from '../lib/prisma';

async function checkAGUStatus() {
  try {
    console.log('='.repeat(80));
    console.log('STATUS DOS SCRAPERS AGU');
    console.log('='.repeat(80));
    console.log('');

    // Contar por categoria
    const categories = [
      'orientacao-normativa',
      'parecer-vinculante',
      'parecer-cgu',
      'parecer-conuni',
      'decor',
      'sumula-agu',
      'acordao-tcu',
    ];

    console.log('📊 DOCUMENTOS POR CATEGORIA:');
    console.log('');

    for (const category of categories) {
      const total = await prisma.document.count({
        where: { category }
      });

      const reviewed = await prisma.document.count({
        where: { category, reviewed: true }
      });

      const unreviewed = total - reviewed;

      console.log(`   ${getCategoryIcon(category)} ${category.toUpperCase()}`);
      console.log(`      Total: ${total}`);
      console.log(`      Revisados: ${reviewed}`);
      console.log(`      Pendentes: ${unreviewed}`);
      console.log('');
    }

    // Total geral
    const totalDocs = await prisma.document.count();
    const totalReviewed = await prisma.document.count({ where: { reviewed: true } });
    const totalUnreviewed = totalDocs - totalReviewed;

    console.log('='.repeat(80));
    console.log('TOTAL GERAL:');
    console.log(`   Documentos: ${totalDocs}`);
    console.log(`   Revisados: ${totalReviewed}`);
    console.log(`   Pendentes: ${totalUnreviewed}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'orientacao-normativa': '📋',
    'parecer-vinculante': '⚖️',
    'parecer-cgu': '📝',
    'parecer-conuni': '📄',
    'decor': '🔍',
    'sumula-agu': '📚',
    'acordao-tcu': '🏛️',
  };
  return icons[category] || '📄';
}

checkAGUStatus()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
