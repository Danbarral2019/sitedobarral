import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

interface ActData {
  type: string;
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  issuer: string;
  publishDate: Date;
  hierarchyLevel: number;
  leiArticles?: string[];
  officialUrl?: string;
}

const missingActs: ActData[] = [
  // === MARGEM DE PREFERÊNCIA — Resoluções CICS ===
  {
    type: 'resolucao',
    number: '2',
    year: 2024,
    fullNumber: 'Resolução SEGES-CICS/MGI 2/2024',
    title: 'Regimento Interno da Comissão Interministerial de Contratações Públicas para Margem de Preferência',
    ementa: 'Aprova o Regimento Interno da Comissão Interministerial de Contratações Públicas para Sustentabilidade - CICS, criada pelo Decreto nº 11.890, de 22 de janeiro de 2024, que regulamenta o art. 26 da Lei nº 14.133/2021.',
    issuer: 'SEGES/MGI',
    publishDate: new Date('2024-07-02'),
    hierarchyLevel: 4,
    leiArticles: ['26'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/resolucoes/resolucao-seges-cics-mgi-no-2-de-2-de-julho-de-2024',
  },
  {
    type: 'resolucao',
    number: '4',
    year: 2024,
    fullNumber: 'Resolução SEGES-CICS/MGI 4/2024',
    title: 'Produtos Manufaturados Nacionais com Margem de Preferência',
    ementa: 'Especifica os produtos manufaturados nacionais que serão objeto de margens de preferência nas licitações da Administração Pública Federal, conforme o art. 26 da Lei nº 14.133/2021 e o Decreto nº 11.890/2024.',
    issuer: 'SEGES/MGI',
    publishDate: new Date('2024-10-18'),
    hierarchyLevel: 4,
    leiArticles: ['26'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/resolucoes/resolucao-seges-cics-mgi-no-4-de-18-de-outubro-de-2024',
  },
  {
    type: 'resolucao',
    number: '5',
    year: 2024,
    fullNumber: 'Resolução SEGES-CICS/MGI 5/2024',
    title: 'Alteração do Regimento Interno da CICS',
    ementa: 'Altera a Resolução SEGES/CICS-MGI nº 2, de 2 de julho de 2024, que aprovou o Regimento Interno da Comissão Interministerial de Contratações Públicas para Sustentabilidade.',
    issuer: 'SEGES/MGI',
    publishDate: new Date('2024-10-18'),
    hierarchyLevel: 4,
    leiArticles: ['26'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/resolucoes/resolucao-seges-cics-mgi-no-5-de-18-de-outubro-de-2024',
  },
  {
    type: 'resolucao',
    number: '6',
    year: 2024,
    fullNumber: 'Resolução SEGES-CICS/MGI 6/2024',
    title: 'Suspensão Temporária de Margens de Preferência',
    ementa: 'Suspende a aplicação de margens de preferência em licitações da Administração Pública Federal, conforme art. 26 da Lei nº 14.133/2021.',
    issuer: 'SEGES/MGI',
    publishDate: new Date('2024-11-25'),
    hierarchyLevel: 4,
    leiArticles: ['26'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/resolucoes/resolucao-seges-cics-mgi-no-6-de-25-de-novembro-de-2024',
  },
  {
    type: 'resolucao',
    number: '7',
    year: 2024,
    fullNumber: 'Resolução CICS/MGI 7/2024',
    title: 'Alteração dos Produtos com Margem de Preferência',
    ementa: 'Altera a Resolução SEGES/CICS-MGI nº 4, de 18 de outubro de 2024, que especifica os produtos manufaturados nacionais sujeitos a margens de preferência.',
    issuer: 'CICS/MGI',
    publishDate: new Date('2024-12-23'),
    hierarchyLevel: 4,
    leiArticles: ['26'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/resolucoes/resolucao-cics-mgi-no-7-de-23-de-dezembro-de-2024',
  },
  {
    type: 'resolucao',
    number: '3',
    year: 2025,
    fullNumber: 'Resolução CIIA-PAC/CC 3/2025',
    title: 'Margem de Preferência para Produtos Manufaturados do PAC',
    ementa: 'Define os produtos manufaturados que ficarão sujeitos à aplicação de margem de preferência nas contratações públicas vinculadas ao Programa de Aceleração do Crescimento - PAC.',
    issuer: 'CIIA-PAC/CC',
    publishDate: new Date('2025-07-28'),
    hierarchyLevel: 4,
    leiArticles: ['26'],
    officialUrl: 'https://www.in.gov.br/en/web/dou/-/resolucao-ciia-pac/cc-n-3-de-28-de-julho-de-2025-645262422',
  },

  // === REGIME DE TRANSIÇÃO ===
  {
    type: 'portaria',
    number: '1.769',
    year: 2023,
    fullNumber: 'Portaria SEGES/MGI 1.769/2023',
    title: 'Regime de Transição da Lei nº 14.133/2021',
    ementa: 'Dispõe sobre o regime de transição de que trata o art. 191 da Lei nº 14.133, de 1º de abril de 2021, no âmbito da Administração Pública Federal direta, autárquica e fundacional.',
    issuer: 'SEGES/MGI',
    publishDate: new Date('2023-04-25'),
    hierarchyLevel: 3,
    leiArticles: ['191'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-1-769-de-25-de-abril-de-2023',
  },
  {
    type: 'portaria',
    number: '4.932',
    year: 2023,
    fullNumber: 'Portaria SEGES/MGI 4.932/2023',
    title: 'Alteração do Regime de Transição da Lei nº 14.133/2021',
    ementa: 'Altera o preâmbulo da Portaria SEGES/MGI nº 1.769, de 25 de abril de 2023, que dispõe sobre o regime de transição de que trata o art. 191 da Lei nº 14.133/2021.',
    issuer: 'SEGES/MGI',
    publishDate: new Date('2023-08-30'),
    hierarchyLevel: 3,
    leiArticles: ['191'],
    officialUrl: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/portarias/portaria-seges-mgi-no-4-932-de-30-de-agosto-de-2023',
  },

  // === MEDIDA PROVISÓRIA ===
  {
    type: 'medida-provisoria',
    number: '1.167',
    year: 2023,
    fullNumber: 'MP 1.167/2023',
    title: 'Prorrogação do Regime de Transição da Lei nº 14.133/2021',
    ementa: 'Altera a Lei nº 14.133, de 1º de abril de 2021, para prorrogar o prazo de que trata o art. 191, que estabelece o regime de transição entre a legislação anterior e a nova lei de licitações.',
    issuer: 'Presidência da República',
    publishDate: new Date('2023-03-31'),
    hierarchyLevel: 1,
    leiArticles: ['191'],
    officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/mpv/mpv1167.htm',
  },
];

async function main() {
  console.log(`Inserindo ${missingActs.length} atos normativos faltantes (lista gov.br)...\n`);

  let created = 0;
  let skipped = 0;

  for (const act of missingActs) {
    const existing = await prisma.legislativeAct.findUnique({
      where: { fullNumber: act.fullNumber },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] ${act.fullNumber} (já existe)`);
      skipped++;
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
        publishDate: act.publishDate,
        hierarchyLevel: act.hierarchyLevel,
        leiArticles: act.leiArticles ? JSON.stringify(act.leiArticles) : null,
        officialUrl: act.officialUrl ?? null,
      },
    });

    console.log(`  [OK] ${act.fullNumber}`);
    created++;
  }

  console.log(`\nResultado: ${created} criados, ${skipped} ignorados.`);

  const total = await prisma.legislativeAct.count();
  console.log(`Total de LegislativeAct no banco: ${total}`);

  await prisma.$disconnect();
}

main().catch(console.error);
