/**
 * Fix Decreto 9.745/2019: scrape do Planalto não funciona (página tem layout
 * antigo). Atualiza com ementa correta e marca scrape como manual.
 */
import { prisma } from '../lib/prisma';

const FULL_NUMBER = 'Decreto 9.745/2019';
const NEW_TITLE = 'Decreto nº 9.745, de 8 de abril de 2019';
const NEW_EMENTA =
  'Aprova a Estrutura Regimental e o Quadro Demonstrativo dos Cargos em Comissão e das Funções de Confiança do Ministério da Economia, remaneja cargos em comissão e funções de confiança, transforma cargos em comissão e funções de confiança e substitui cargos em comissão do Grupo-Direção e Assessoramento Superiores - DAS por Funções Comissionadas do Poder Executivo - FCPE.';
const NEW_CONTENT_PREFIX = `DECRETO Nº 9.745, DE 8 DE ABRIL DE 2019\n\n${NEW_EMENTA}\n\nO PRESIDENTE DA REPÚBLICA, no uso das atribuições que lhe confere o art. 84, caput, incisos IV e VI, alínea "a", da Constituição,\n\nDECRETA:\n\nArt. 1º Ficam aprovados a Estrutura Regimental e o Quadro Demonstrativo dos Cargos em Comissão e das Funções de Confiança do Ministério da Economia, na forma dos Anexos I e II.\n\n[Texto integral disponível no Planalto via link oficial — esta versão é resumida pela limitação do scraper automático na página antiga do Planalto.]`;

async function main() {
  const apply = process.argv.includes('--apply');
  const act = await prisma.legislativeAct.findUnique({ where: { fullNumber: FULL_NUMBER } });
  if (!act) {
    console.log('NÃO ENCONTRADO');
    process.exit(1);
  }
  console.log(`📋 ${FULL_NUMBER}`);
  console.log(`   title atual: "${act.title}"`);
  console.log(`   chars atual: ${act.content?.length ?? 0}`);
  console.log(`\n   title novo:  "${NEW_TITLE}"`);
  console.log(`   ementa nova: "${NEW_EMENTA.slice(0, 100)}..."`);
  console.log(`   content novo: ${NEW_CONTENT_PREFIX.length} chars (resumo manual)\n`);

  if (!apply) {
    console.log('🔒 dry-run');
    await prisma.$disconnect();
    return;
  }

  await prisma.legislativeAct.update({
    where: { id: act.id },
    data: {
      title: NEW_TITLE,
      ementa: NEW_EMENTA,
      content: NEW_CONTENT_PREFIX,
      scrapeStatus: 'manual',
      scrapeError: 'Scraper automático falhou — página do Planalto sem seletor compatível. Conteúdo preenchido manualmente com ementa oficial.',
    },
  });
  console.log('✅ atualizado');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
