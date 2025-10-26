// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Analisa ONs com múltiplas fundamentações
 */
async function analyzeMultipleFundamentacoes() {
  try {
    console.log('🔍 Analisando ONs com múltiplas fundamentações...\n');

    // Buscar todas as ONs
    const ons = await prisma.document.findMany({
      where: { category: 'orientacao-normativa' },
      select: {
        id: true,
        title: true,
        url: true,
        isCommon: true,
      }
    });

    console.log(`📊 Total de ONs: ${ons.length}\n`);

    // Agrupar por título base (removendo "(Fundamentação X)")
    const byTitle = {};
    ons.forEach(on => {
      // Remover "(Fundamentação X)" e "- Redação original"
      const baseTitle = on.title
        .replace(/\(Fundamentação\s+\d+\)/gi, '')
        .replace(/\s*-\s*Redação original.*$/i, '')
        .trim();

      if (!byTitle[baseTitle]) {
        byTitle[baseTitle] = [];
      }
      byTitle[baseTitle].push(on);
    });

    // Filtrar apenas ONs com múltiplas entradas
    const multiple = Object.entries(byTitle)
      .filter(([_, docs]) => docs.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`📋 ONs com múltiplas fundamentações: ${multiple.length}`);
    console.log(`📋 ONs únicas (sem duplicatas): ${Object.keys(byTitle).length}\n`);

    if (multiple.length === 0) {
      console.log('✅ Nenhuma ON com múltiplas fundamentações!');
      return;
    }

    // Mostrar exemplos
    console.log('📄 Exemplos de ONs com múltiplas fundamentações:\n');
    multiple.slice(0, 10).forEach(([baseTitle, docs], idx) => {
      console.log(`${idx + 1}. ${baseTitle}`);
      console.log(`   Total de entradas: ${docs.length}`);
      docs.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.title}`);
        console.log(`      URL: ${doc.url.substring(0, 80)}...`);
        console.log(`      ID: ${doc.id}`);
      });
      console.log('');
    });

    // Estatísticas
    const totalDuplicates = multiple.reduce((sum, [_, docs]) => sum + (docs.length - 1), 0);
    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`   ONs únicas: ${Object.keys(byTitle).length}`);
    console.log(`   ONs com múltiplas entradas: ${multiple.length}`);
    console.log(`   Total de entradas duplicadas: ${totalDuplicates}`);
    console.log(`   Registros que podem ser consolidados: ${totalDuplicates}\n`);

    // Analisar padrões de URL
    console.log('🔗 Análise de URLs:');
    const urlPatterns = {
      sapiens: 0,
      dou: 0,
      govbr: 0,
    };

    ons.forEach(on => {
      if (on.url.includes('sapiens.agu.gov.br')) {
        urlPatterns.sapiens++;
      } else if (on.url.includes('in.gov.br')) {
        urlPatterns.dou++;
      } else if (on.url.includes('gov.br')) {
        urlPatterns.govbr++;
      }
    });

    console.log(`   Sapiens PDFs: ${urlPatterns.sapiens}`);
    console.log(`   DOU (in.gov.br): ${urlPatterns.dou}`);
    console.log(`   Gov.br (outros): ${urlPatterns.govbr}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeMultipleFundamentacoes();
