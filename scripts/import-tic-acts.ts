/**
 * Script para importar atos normativos de contratações de TIC
 *
 * Importa INs e Portarias da SGD/MGI e Decretos federais
 * relacionados à contratação de soluções de TIC.
 *
 * Usage:
 *   npx tsx scripts/import-tic-acts.ts              # Importar todos
 *   npx tsx scripts/import-tic-acts.ts --dry-run    # Simular sem alterar
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

interface TicAct {
  type: 'in' | 'portaria' | 'decreto';
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  issuer: string;
  publishDate: string; // ISO date
  hierarchyLevel: number;
  officialUrl: string | null;
  pdfUrl: string | null;
  leiArticles: string[];
  themes: string[];
}

const TIC_ACTS: TicAct[] = [
  {
    type: 'in',
    number: '94',
    year: 2022,
    fullNumber: 'IN SGD/ME nº 94/2022',
    title: 'Processo de Contratação de Soluções de TIC',
    ementa: 'Dispõe sobre o processo de contratação de soluções de Tecnologia da Informação e Comunicação - TIC pelos órgãos e entidades integrantes do Sistema de Administração dos Recursos de Tecnologia da Informação - SISP do Poder Executivo Federal.',
    issuer: 'SGD/MGI',
    publishDate: '2022-04-23',
    hierarchyLevel: 4,
    officialUrl: 'https://www.gov.br/governodigital/pt-br/legislacao/instrucao-normativa-sgd-me-no-94-de-23-de-dezembro-de-2022',
    pdfUrl: null,
    leiArticles: ['18', '19', '20', '21', '72', '75'],
    themes: ['tic', 'planejamento'],
  },
  {
    type: 'in',
    number: '6',
    year: 2023,
    fullNumber: 'IN SGD/MGI nº 6/2023',
    title: 'Aprovação de Contratações de TIC',
    ementa: 'Altera a Instrução Normativa SGD/ME nº 94, de 23 de dezembro de 2022, que dispõe sobre o processo de contratação de soluções de Tecnologia da Informação e Comunicação - TIC. Alterada pela IN SGD/MGI nº 86/2025.',
    issuer: 'SGD/MGI',
    publishDate: '2023-06-13',
    hierarchyLevel: 4,
    officialUrl: 'https://www.gov.br/governodigital/pt-br/legislacao/in-sgd-mgi-no-6-de-13-de-junho-de-2023',
    pdfUrl: null,
    leiArticles: ['18', '19'],
    themes: ['tic', 'planejamento'],
  },
  {
    type: 'portaria',
    number: '750',
    year: 2023,
    fullNumber: 'Portaria SGD/MGI nº 750/2023',
    title: 'Desenvolvimento e Manutenção de Software',
    ementa: 'Estabelece modelo de contratação de serviços de desenvolvimento e manutenção de software para os órgãos e entidades integrantes do SISP. Alterada pela Portaria SGD/MGI nº 6.679/2024.',
    issuer: 'SGD/MGI',
    publishDate: '2023-03-20',
    hierarchyLevel: 3,
    officialUrl: 'https://www.gov.br/governodigital/pt-br/legislacao/portaria-sgd-mgi-no-750-de-20-de-marco-de-2023',
    pdfUrl: null,
    leiArticles: ['6'],
    themes: ['tic', 'contratos'],
  },
  {
    type: 'portaria',
    number: '5.950',
    year: 2023,
    fullNumber: 'Portaria SGD/MGI nº 5.950/2023',
    title: 'Contratação de Software e Nuvem',
    ementa: 'Estabelece modelo de contratação de software e de serviços de computação em nuvem para os órgãos e entidades integrantes do SISP.',
    issuer: 'SGD/MGI',
    publishDate: '2023-10-26',
    hierarchyLevel: 3,
    officialUrl: 'https://www.gov.br/governodigital/pt-br/legislacao/portaria-sgd-mgi-no-5950-de-26-de-outubro-de-2023',
    pdfUrl: null,
    leiArticles: ['6', '75'],
    themes: ['tic', 'contratos'],
  },
  {
    type: 'portaria',
    number: '2.715',
    year: 2023,
    fullNumber: 'Portaria SGD/MGI nº 2.715/2023',
    title: 'Contratação de Estações de Trabalho',
    ementa: 'Estabelece modelo de contratação de estações de trabalho (desktops, notebooks e terminais) para os órgãos e entidades integrantes do SISP.',
    issuer: 'SGD/MGI',
    publishDate: '2023-06-30',
    hierarchyLevel: 3,
    officialUrl: null,
    pdfUrl: null,
    leiArticles: ['6', '82'],
    themes: ['tic', 'registro-precos'],
  },
  {
    type: 'portaria',
    number: '1.070',
    year: 2023,
    fullNumber: 'Portaria SGD/MGI nº 1.070/2023',
    title: 'Infraestrutura e Atendimento de TIC',
    ementa: 'Estabelece modelo de contratação de serviços de infraestrutura e atendimento de TIC para os órgãos e entidades integrantes do SISP. Alterada pela Portaria SGD/MGI nº 6.680/2024.',
    issuer: 'SGD/MGI',
    publishDate: '2023-04-05',
    hierarchyLevel: 3,
    officialUrl: null,
    pdfUrl: null,
    leiArticles: ['6'],
    themes: ['tic', 'contratos', 'gestao-fiscalizacao'],
  },
  {
    type: 'portaria',
    number: '370',
    year: 2023,
    fullNumber: 'Portaria SGD/MGI nº 370/2023',
    title: 'Outsourcing de Impressão',
    ementa: 'Estabelece modelo de contratação de serviços de outsourcing de impressão para os órgãos e entidades integrantes do SISP.',
    issuer: 'SGD/MGI',
    publishDate: '2023-02-01',
    hierarchyLevel: 3,
    officialUrl: null,
    pdfUrl: null,
    leiArticles: ['6'],
    themes: ['tic', 'contratos'],
  },
  {
    type: 'portaria',
    number: '6.040',
    year: 2025,
    fullNumber: 'Portaria SGD/MGI nº 6.040/2025',
    title: 'Mapa de Pesquisa Salarial para TIC',
    ementa: 'Estabelece o mapa de pesquisa salarial para fins de elaboração de planilhas de custos e formação de preços nas contratações de serviços de TIC no âmbito do SISP.',
    issuer: 'SGD/MGI',
    publishDate: '2025-01-15',
    hierarchyLevel: 3,
    officialUrl: null,
    pdfUrl: null,
    leiArticles: ['23'],
    themes: ['tic', 'pesquisa-precos', 'planejamento'],
  },
  {
    type: 'decreto',
    number: '7.174',
    year: 2010,
    fullNumber: 'Decreto 7.174/2010',
    title: 'Contratação de Bens e Serviços de Informática',
    ementa: 'Regulamenta a contratação de bens e serviços de informática e automação pela administração pública federal, direta ou indireta, pelas fundações instituídas ou mantidas pelo Poder Público e pelas demais organizações sob o controle direto ou indireto da União.',
    issuer: 'Presidência',
    publishDate: '2010-05-12',
    hierarchyLevel: 2,
    officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7174.htm',
    pdfUrl: null,
    leiArticles: [],
    themes: ['tic', 'modalidades'],
  },
  {
    type: 'decreto',
    number: '10.193',
    year: 2019,
    fullNumber: 'Decreto 10.193/2019',
    title: 'Governança para Contratações de TIC',
    ementa: 'Estabelece limites e instâncias de governança para a contratação de bens e serviços de tecnologia da informação e comunicação no âmbito da administração pública federal direta, autárquica e fundacional.',
    issuer: 'Presidência',
    publishDate: '2019-12-27',
    hierarchyLevel: 2,
    officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/D10193.htm',
    pdfUrl: null,
    leiArticles: [],
    themes: ['tic', 'agentes-governanca'],
  },
];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Importação de Atos Normativos de TIC`);
  console.log(`  ${DRY_RUN ? '🔍 MODO DRY-RUN (sem alterações)' : '✅ MODO EXECUÇÃO'}`);
  console.log(`${'='.repeat(60)}\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const act of TIC_ACTS) {
    try {
      // Verificar se já existe
      const existing = await prisma.legislativeAct.findUnique({
        where: { fullNumber: act.fullNumber },
      });

      if (existing) {
        console.log(`⏭️  Já existe: ${act.fullNumber}`);

        // Verificar se precisa adicionar tag 'tic' aos themes
        const existingThemes: string[] = existing.themes ? JSON.parse(existing.themes) : [];
        if (!existingThemes.includes('tic')) {
          if (!DRY_RUN) {
            const updatedThemes = [...new Set([...existingThemes, 'tic'])];
            await prisma.legislativeAct.update({
              where: { id: existing.id },
              data: { themes: JSON.stringify(updatedThemes) },
            });
            console.log(`   ✅ Adicionada tag 'tic' aos themes`);
          } else {
            console.log(`   [DRY-RUN] Adicionaria tag 'tic' aos themes`);
          }
        }

        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY-RUN] Importaria: ${act.fullNumber}`);
        console.log(`   Título: ${act.title}`);
        console.log(`   Ementa: ${act.ementa.slice(0, 100)}...`);
        console.log(`   Temas: ${act.themes.join(', ')}`);
        imported++;
        continue;
      }

      await prisma.legislativeAct.create({
        data: {
          type: act.type,
          number: act.number,
          year: act.year,
          fullNumber: act.fullNumber,
          title: act.title,
          ementa: act.ementa,
          issuer: act.issuer,
          publishDate: new Date(act.publishDate),
          hierarchyLevel: act.hierarchyLevel,
          officialUrl: act.officialUrl,
          pdfUrl: act.pdfUrl,
          leiArticles: JSON.stringify(act.leiArticles),
          themes: JSON.stringify(act.themes),
          esfera: 'federal',
          embeddingStatus: 'pending',
          createdBy: 'import-tic-acts',
        },
      });

      console.log(`✅ Importado: ${act.fullNumber} — ${act.title}`);
      imported++;
    } catch (err) {
      console.error(`❌ Erro ao importar ${act.fullNumber}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  RESULTADO:`);
  console.log(`  ✅ Importados: ${imported}`);
  console.log(`  ⏭️  Já existiam: ${skipped}`);
  console.log(`  ❌ Erros: ${errors}`);
  console.log(`  Total TIC: ${TIC_ACTS.length}`);
  console.log(`${'='.repeat(60)}\n`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Erro fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
