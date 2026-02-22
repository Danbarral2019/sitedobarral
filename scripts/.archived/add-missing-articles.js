/**
 * Script temporário para adicionar artigos faltantes da Lei 14.133
 * - Art. 184-A (incluído pela Lei 14.770/2023)
 * - Art. 194 (vigência)
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('➕ Adicionando artigos faltantes da Lei 14.133/2021\n');

  // Art. 184-A
  const art184A = {
    numero: '184-A',
    titulo: null,
    capituloCompleto: null,
    ementa: `Art. 184-A. À celebração, à execução, ao acompanhamento e à prestação de contas dos convênios, contratos de repasse e instrumentos congêneres em que for parte a União, com valor global de até R$ 1.500.000,00 (um milhão e quinhentos mil reais), aplicar-se-á o seguinte regime simplificado:

I - o plano de trabalho aprovado conterá parâmetros objetivos para caracterizar o cumprimento do objeto;

II - a minuta dos instrumentos deverá ser simplificada;

III - a liberação dos recursos dar-se-á em parcela única;

IV - a verificação da execução do objeto ocorrerá mediante visita de constatação da compatibilidade com o plano de trabalho.

§ 1º O acompanhamento pela concedente ou mandatária será realizado pela verificação dos boletins de medição e fotos georreferenciadas registradas pela empresa executora e pelo convenente do Transferegov e por vistorias in loco, realizadas considerando o marco de execução de 100% (cem por cento) do cronograma físico, podendo ocorrer outras vistorias, quando necessárias.

§ 2º Não haverá análise nem aceite de termo de referência, anteprojeto, projeto, orçamento, resultado do processo licitatório ou outro documento necessário para o início da execução do objeto, e caberá à concedente ou mandatária verificar o cumprimento do objeto pactuado ao final da execução do instrumento.

§ 3º Quando exigidos, os registros dos projetos de engenharia, dos documentos de titularidade de área, do licenciamento ambiental e do processo licitatório pelo convenente no Transferegov constituirão condição para a liberação da parcela única dos recursos de que trata o inciso III do caput deste artigo.

§ 4º O regime simplificado de que trata este artigo aplica-se aos convênios, contratos de repasse e instrumentos congêneres celebrados após a publicação desta Lei.

(Incluído pela Lei nº 14.770, de 2023) (Vide Decreto nº 12.343, de 2024)`,
    capitulo: 'TÍTULO VII - CAPÍTULO III',
    secao: 'Dos Convênios e Contratos de Repasse'
  };

  // Art. 194
  const art194 = {
    numero: '194',
    titulo: null,
    capituloCompleto: null,
    ementa: 'Art. 194. Esta Lei entra em vigor na data de sua publicação.',
    capitulo: 'DISPOSIÇÕES FINAIS',
    secao: null
  };

  try {
    // Verificar se artigos já existem
    const existing184A = await prisma.leiArticle.findUnique({
      where: { numero: '184-A' }
    });

    const existing194 = await prisma.leiArticle.findUnique({
      where: { numero: '194' }
    });

    let created = 0;
    let updated = 0;

    // Art. 184-A
    if (existing184A) {
      await prisma.leiArticle.update({
        where: { numero: '184-A' },
        data: art184A
      });
      console.log('✅ Art. 184-A atualizado');
      updated++;
    } else {
      await prisma.leiArticle.create({
        data: art184A
      });
      console.log('🆕 Art. 184-A criado');
      created++;
    }

    // Art. 194
    if (existing194) {
      await prisma.leiArticle.update({
        where: { numero: '194' },
        data: art194
      });
      console.log('✅ Art. 194 atualizado');
      updated++;
    } else {
      await prisma.leiArticle.create({
        data: art194
      });
      console.log('🆕 Art. 194 criado');
      created++;
    }

    console.log('\n📊 RESUMO:');
    console.log(`   Criados: ${created}`);
    console.log(`   Atualizados: ${updated}`);
    console.log('');

    // Verificar contagem total
    const total = await prisma.leiArticle.count();
    console.log(`✅ Total de artigos no banco: ${total}`);
    console.log('');

    if (total === 195) {
      console.log('🎉 SUCESSO! Lei 14.133 agora está completa com 195 artigos:');
      console.log('   - Artigos 1 a 183: 183 artigos');
      console.log('   - Art. 184-A: 1 artigo (incluído pela Lei 14.770/2023)');
      console.log('   - Artigos 184 a 193: 10 artigos');
      console.log('   - Art. 194 (vigência): 1 artigo');
    } else {
      console.log(`⚠️  Atenção: Total de artigos = ${total} (esperado: 195)`);
    }

    console.log('');
    console.log('📋 Próximo passo:');
    console.log('   node scripts/backup-lei-14133.js');

  } catch (error) {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
