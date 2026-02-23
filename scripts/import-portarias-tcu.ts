import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

interface PortariaData {
  title: string;
  description: string;
  url: string;
  alternativeUrls?: string[];
  leiArticles?: string[];
}

const portarias: PortariaData[] = [
  {
    title: 'Portaria-TCU nº 6, de 13 de janeiro de 2021',
    description: 'Delegação de competências em matéria de licitações, contratações e sanções no âmbito do Tribunal de Contas da União.',
    url: 'https://pesquisa.apps.tcu.gov.br/doc/norma/Portaria/TCU/6/2021/',
  },
  {
    title: 'Portaria-TCU nº 133, de 9 de junho de 2021',
    description: 'Altera a Portaria-TCU nº 6/2021, com ajustes para o regime da Lei nº 14.133/2021.',
    url: 'https://pesquisa.apps.tcu.gov.br/doc/norma/Portaria/TCU/133/2021/',
  },
  {
    title: 'Portaria-TCU nº 175, de 28 de junho de 2022',
    description: 'Dispõe sobre o Plano de Contratações Anual (PCA) do Tribunal de Contas da União.',
    url: 'https://portal.tcu.gov.br/transparencia-e-prestacao-de-contas/servico/plano-de-contratacoes-anual',
    leiArticles: ['12'],
  },
  {
    title: 'Portaria-TCU nº 3, de 2 de janeiro de 2025',
    description: 'Delega competência ao Secretário-Geral de Administração para praticar atos de gestão orçamentária e financeira, patrimonial, de compras e contratações, de gestão do Quadro de Pessoal, e demais atribuições da Segedam. Revogou as Portarias-TCU nº 6/2023 e nº 126/2024.',
    url: 'https://pesquisa.apps.tcu.gov.br/doc/norma/Portaria/TCU/3/2025/',
    leiArticles: ['8', '12', '31', '74', '75', '82', '86', '140', '156', '162'],
  },
  {
    title: 'Portaria-TCU nº 121, de 28 de junho de 2023',
    description: 'Dispõe sobre a fase preparatória e a fase de seleção do fornecedor (Documento de Formalização da Demanda, vínculo ao PCA, entre outros) no âmbito da Secretaria do Tribunal de Contas da União.',
    url: 'https://btcu.apps.tcu.gov.br/api/obterDocumentoPdf/74013272',
    leiArticles: ['12', '18'],
  },
  {
    title: 'Portaria-TCU nº 122, de 28 de junho de 2023',
    description: 'Dispõe sobre a gestão e fiscalização de contratos de serviços, compras e fornecimentos contínuos no âmbito da Secretaria do Tribunal de Contas da União.',
    url: 'https://pesquisa.apps.tcu.gov.br/doc/norma/Portaria/TCU/122/2023/',
    leiArticles: ['117', '121'],
  },
  {
    title: 'Portaria-TCU nº 202, de 13 de dezembro de 2023',
    description: 'Aprova a 5ª edição do Manual "Licitações e Contratos: orientações e jurisprudência do TCU" (BTCU Especial nº 30/2023).',
    url: 'https://portal.tcu.gov.br/publicacoes-institucionais/cartilha-manual-ou-tutorial/licitacoes-e-contratos-orientacoes-e-jurisprudencia-do-tcu.htm',
    alternativeUrls: ['https://btcu.apps.tcu.gov.br/api/obterDocumentoPdf/75119406'],
  },
  {
    title: 'Portaria-TCU nº 8, de 27 de janeiro de 2026',
    description: 'Institui a Política de Governança e Gestão das Contratações de Serviços Contínuos com Regime de Dedicação Exclusiva de Mão de Obra (DEMO) no âmbito do Tribunal de Contas da União.',
    url: 'https://www.in.gov.br/web/dou/-/portaria-tcu-n-8-de-27-de-janeiro-de-2026-683627639',
    alternativeUrls: ['http://pesquisa.in.gov.br/imprensa/jsp/visualiza/index.jsp?data=28/01/2026&jornal=515&pagina=108'],
    leiArticles: ['121'],
  },
];

async function main() {
  console.log('Inserindo 8 Portarias do TCU na aba "Outros Atos"...\n');

  let created = 0;
  let skipped = 0;

  for (const p of portarias) {
    // Check if already exists by title
    const existing = await prisma.document.findFirst({
      where: { title: p.title },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] ${p.title} (já existe)`);
      skipped++;
      continue;
    }

    await prisma.document.create({
      data: {
        title: p.title,
        description: p.description,
        type: 'link',
        url: p.url,
        category: 'boa_pratica',
        isPublic: true,
        isCommon: true,
        reviewed: true,
        reviewedAt: new Date(),
        issuerOrg: 'TCU',
        esfera: 'federal',
        tags: JSON.stringify(['TCU', 'licitações', 'contratos', 'portaria']),
        leiArticles: p.leiArticles ? JSON.stringify(p.leiArticles) : null,
        alternativeUrls: p.alternativeUrls ? JSON.stringify(p.alternativeUrls) : null,
      },
    });

    console.log(`  [OK] ${p.title}`);
    created++;
  }

  console.log(`\nResultado: ${created} criados, ${skipped} ignorados.`);

  // Verify
  const total = await prisma.document.count({
    where: { category: 'boa_pratica', issuerOrg: 'TCU' },
  });
  console.log(`Total de Portarias TCU na aba "Outros Atos": ${total}`);

  await prisma.$disconnect();
}

main().catch(console.error);
