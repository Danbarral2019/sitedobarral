/**
 * Script para testar geração de resumos automáticos
 */

// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando documentos para teste...\n');

  // Busca um documento de cada categoria principal
  const categories = [
    'orientacao-normativa',
    'acordao',
    'parecer',
    'apostila'
  ];

  for (const category of categories) {
    const doc = await prisma.document.findFirst({
      where: { category },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        summary: true,
        summaryGeneratedAt: true,
      }
    });

    if (doc) {
      console.log(`📄 ${category.toUpperCase()}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Título: ${doc.title.substring(0, 80)}...`);
      console.log(`   Descrição: ${doc.description ? doc.description.substring(0, 80) + '...' : 'N/A'}`);
      console.log(`   Tem Resumo: ${doc.summary ? 'SIM' : 'NÃO'}`);
      if (doc.summaryGeneratedAt) {
        console.log(`   Gerado em: ${new Date(doc.summaryGeneratedAt).toLocaleString('pt-BR')}`);
      }
      console.log('');
    }
  }

  // Estatísticas gerais
  const total = await prisma.document.count();
  const withSummary = await prisma.document.count({
    where: { summary: { not: null } }
  });

  console.log('📊 ESTATÍSTICAS:');
  console.log(`   Total de documentos: ${total}`);
  console.log(`   Com resumo: ${withSummary}`);
  console.log(`   Sem resumo: ${total - withSummary}`);
  console.log(`   Cobertura: ${total > 0 ? ((withSummary / total) * 100).toFixed(1) : 0}%`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
