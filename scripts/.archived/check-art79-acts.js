require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function safeParseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try CSV
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

async function main() {
  // Buscar atos normativos que incluem o art. 79
  const actsFor79 = await prisma.legislativeAct.findMany({
    where: {
      leiArticles: { not: null }
    },
    select: {
      fullNumber: true,
      title: true,
      leiArticles: true,
      type: true
    }
  });

  console.log('ATOS NORMATIVOS PARA O ART. 79:');
  console.log('================================\n');

  const relevant = actsFor79.filter(act => {
    const articles = safeParseArray(act.leiArticles);
    return articles.includes('79') || articles.includes(79);
  });

  if (relevant.length === 0) {
    console.log('Nenhum ato normativo encontrado para o Art. 79');
  } else {
    relevant.forEach(act => {
      console.log('- ' + act.fullNumber);
      console.log('  Tipo: ' + act.type);
      console.log('  Titulo: ' + act.title.substring(0, 70) + '...');
      console.log('');
    });
    console.log('Total: ' + relevant.length + ' atos normativos');
  }

  // Verificar também documentos
  const docsFor79 = await prisma.document.findMany({
    where: {
      leiArticles: { not: null }
    },
    select: {
      title: true,
      leiArticles: true,
      category: true
    }
  });

  const relevantDocs = docsFor79.filter(doc => {
    const articles = safeParseArray(doc.leiArticles);
    return articles.includes('79') || articles.includes(79);
  });

  console.log('\n\nDOCUMENTOS PARA O ART. 79:');
  console.log('==========================\n');

  if (relevantDocs.length === 0) {
    console.log('Nenhum documento encontrado para o Art. 79');
  } else {
    relevantDocs.forEach(doc => {
      console.log('- ' + doc.title.substring(0, 60) + '...');
      console.log('  Categoria: ' + (doc.category || 'N/A'));
      console.log('');
    });
    console.log('Total: ' + relevantDocs.length + ' documentos');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
