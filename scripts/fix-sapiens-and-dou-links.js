// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Substitui links do Sapiens (restrito) e DOU (quebrados) pelo link da página oficial das ONs
 */
async function fixSapiensAndDouLinks() {
  try {
    console.log('🔧 Corrigindo links do Sapiens e DOU...\n');

    const linkOficial = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

    // 1. Buscar ONs com links problemáticos
    const onsProblematicas = await prisma.document.findMany({
      where: {
        category: 'orientacao-normativa',
        OR: [
          { url: { contains: 'sapiens.agu.gov.br' } },
          { url: { contains: 'in.gov.br' } },
          { url: { contains: 'imprensa.nacional' } },
        ]
      },
      select: {
        id: true,
        title: true,
        url: true,
        description: true,
      }
    });

    console.log(`📊 ONs com links problemáticos: ${onsProblematicas.length}\n`);

    if (onsProblematicas.length === 0) {
      console.log('✅ Nenhum link problemático encontrado!');
      return;
    }

    // 2. Separar por tipo de problema
    const sapiensOns = onsProblematicas.filter(on => on.url.includes('sapiens.agu.gov.br'));
    const douOns = onsProblematicas.filter(on =>
      on.url.includes('in.gov.br') || on.url.includes('imprensa.nacional')
    );

    console.log(`📋 Links do Sapiens (restrito): ${sapiensOns.length}`);
    console.log(`📋 Links do DOU (quebrados): ${douOns.length}\n`);

    // 3. Atualizar cada ON
    let updated = 0;

    for (const on of onsProblematicas) {
      const tipoProblema = on.url.includes('sapiens.agu.gov.br')
        ? 'Sapiens (sistema restrito a membros da AGU)'
        : 'DOU (link indisponível)';

      // Adicionar nota na descrição
      const notaExplicativa = `\n\n⚠️ Nota: O link de fundamentação original (${tipoProblema}) não está disponível. Para consultar esta ON, acesse a página oficial das Orientações Normativas da AGU.`;

      const novaDescricao = on.description
        ? on.description + notaExplicativa
        : `Orientação Normativa da AGU.${notaExplicativa}`;

      await prisma.document.update({
        where: { id: on.id },
        data: {
          url: linkOficial,
          description: novaDescricao,
        }
      });

      console.log(`   ✅ ${on.title}`);
      console.log(`      Antes: ${on.url.substring(0, 60)}...`);
      console.log(`      Depois: ${linkOficial}`);
      console.log(`      Tipo: ${tipoProblema}\n`);

      updated++;
    }

    console.log(`\n📊 RESULTADO:`);
    console.log(`   ONs atualizadas: ${updated}`);
    console.log(`   Link Sapiens substituídos: ${sapiensOns.length}`);
    console.log(`   Links DOU substituídos: ${douOns.length}`);
    console.log(`   Novo link: ${linkOficial}`);

    // 4. Verificar resultado
    const remaining = await prisma.document.count({
      where: {
        category: 'orientacao-normativa',
        OR: [
          { url: { contains: 'sapiens.agu.gov.br' } },
          { url: { contains: 'in.gov.br' } },
          { url: { contains: 'imprensa.nacional' } },
        ]
      }
    });

    console.log(`\n📊 Links problemáticos restantes: ${remaining}`);

    if (remaining === 0) {
      console.log('🎉 Sucesso! Todos os links problemáticos foram corrigidos!');
    } else {
      console.log('⚠️  Ainda há links problemáticos. Execute novamente se necessário.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixSapiensAndDouLinks();
