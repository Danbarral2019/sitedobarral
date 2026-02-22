/**
 * Script para adicionar o Art. 44-A à Lei 14.133
 *
 * Adicionado pela Lei 15.210/2025 (DOU 17.09.2025)
 * Vigência: 180 dias após publicação
 *
 * Localização: Título II > Capítulo II > Seção IV > Subseção I (Das Compras)
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Adicionando Art. 44-A à Lei 14.133...\n');

  // Verificar se já existe
  const existing = await prisma.leiArticle.findUnique({
    where: { numero: '44-A' }
  });

  if (existing) {
    console.log('⚠️  Art. 44-A já existe no banco de dados.');
    console.log('   ID:', existing.id);
    await prisma.$disconnect();
    return;
  }

  // Texto completo do Art. 44-A (Lei 15.210/2025)
  const ementa = `O processo licitatório para compra de equipamento destinado a procedimento diagnóstico ou terapêutico no âmbito do Sistema Único de Saúde (SUS) que tenha valor superior ao previsto no inciso II do art. 75 desta Lei deve levar em consideração o seu adequado aproveitamento ao longo de sua vida útil.

§ 1º No edital de licitação, deve constar a demonstração da capacidade instalada para operação do equipamento ou o plano de atendimento aos requisitos necessários à operação.

§ 2º (VETADO).

§ 3º (VETADO).

§ 4º (VETADO).

§ 5º (VETADO).`;

  // Criar o artigo
  const article = await prisma.leiArticle.create({
    data: {
      numero: '44-A',
      titulo: 'TÍTULO II - DAS LICITAÇÕES',
      capituloCompleto: 'CAPÍTULO II - DA FASE PREPARATÓRIA',
      capitulo: 'TÍTULO II - CAPÍTULO II',
      secao: 'Seção IV - Disposições Setoriais - Subseção I - Das Compras',
      ementa: ementa,
    }
  });

  console.log('✅ Art. 44-A adicionado com sucesso!');
  console.log('   ID:', article.id);
  console.log('   Título:', article.titulo);
  console.log('   Capítulo:', article.capituloCompleto);
  console.log('   Seção:', article.secao);
  console.log('\n📋 Texto:');
  console.log(article.ementa.substring(0, 200) + '...');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Erro:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
