/**
 * Script de Importação - ONs da extinta CNU (Câmara Nacional de Uniformização)
 *
 * Importa as Orientações Normativas da CNU/CGU/AGU para o banco de dados.
 * Mesma eficácia das ONs da AGU. Incluídas na mesma categoria 'orientacao-normativa'.
 *
 * Uso: npx tsx scripts/import-ons-cnu.ts [--dry-run]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { prisma } from '../lib/prisma';

interface CNUOrientacaoNormativa {
  numero: number;
  ano: number;
  data: string; // ISO date
  texto: string;
  observacao?: string;
  tags: string[];
}

const ONS_CNU: CNUOrientacaoNormativa[] = [
  {
    numero: 1,
    ano: 2016,
    data: '2016-06-22',
    texto: 'Na cessão de uso de imóvel administrado pela União, para fins de prestação de serviços comuns em favor de servidores públicos e administrados, é obrigatória a modalidade licitatória pregão, preferencialmente eletrônico, tendo em vista que estes são o verdadeiro objeto contratual. Caso constatada a inviabilidade da forma eletrônica, deverá ser utilizada, excepcionalmente, a forma presencial, desde que por ato fundamentado em justificativas concretas e detalhadas.',
    observacao: 'REVISÃO EM ANDAMENTO — Parecer n. 00022/2024/CNLCA/CGU/AGU e DESPACHO',
    tags: ['AGU', 'CNU', 'ON CNU 01/2016', 'Pregão', 'Cessão de uso', 'Imóvel'],
  },
  {
    numero: 2,
    ano: 2016,
    data: '2016-06-28',
    texto: 'Nova redação dada pela Orientação Normativa AGU nº 80/2024. Consultar a ON AGU nº 80/2024 para o texto vigente.',
    observacao: 'Nova redação dada pela ON AGU nº 80/2024',
    tags: ['AGU', 'CNU', 'ON CNU 02/2016', 'Substituída'],
  },
  {
    numero: 3,
    ano: 2016,
    data: '2016-08-17',
    texto: 'O gozo da licença gestante, da licença adotante e da licença paternidade não implica a suspensão da contagem do prazo do estágio probatório previsto no art. 41, § 4º, da Constituição.',
    tags: ['AGU', 'CNU', 'ON CNU 03/2016', 'Estágio probatório', 'Licença gestante', 'Licença paternidade'],
  },
  {
    numero: 4,
    ano: 2016,
    data: '2016-09-14',
    texto: 'Não há obrigação normativa acerca da utilização das ferramentas governamentais de pesquisa e busca de preços, não havendo óbice, portanto, à contratação de sistemas privados, desde que devidamente justificada pela Administração.',
    tags: ['AGU', 'CNU', 'ON CNU 04/2016', 'Pesquisa de preços', 'Contratação'],
  },
  {
    numero: 6,
    ano: 2017,
    data: '2017-04-26',
    texto: 'Não cabe à Câmara Nacional de Uniformização de Entendimentos Consultivos conhecer de questões jurídicas em que a divergência envolva órgão ou entidade que não se vincule às orientações da Advocacia-Geral da União.',
    tags: ['AGU', 'CNU', 'ON CNU 06/2017', 'Competência', 'Câmara Nacional de Uniformização'],
  },
  {
    numero: 7,
    ano: 2017,
    data: '2017-08-23',
    texto: 'I - O rol das causas suspensivas do estágio probatório elencadas no §5º, do art. 20, da Lei nº 8.112, de 1990, deve ser interpretado como exemplificativo.\n\nII – Considera-se efetivo exercício, para fins de cômputo do prazo do estágio probatório, apenas aquelas ausências, afastamentos e licenças que forem comuns a todos os servidores públicos.\n\nIII – Excepciona-se a regra do item II apenas às licenças maternidade, paternidade e adotante.',
    tags: ['AGU', 'CNU', 'ON CNU 07/2017', 'Estágio probatório', 'Lei 8.112/1990', 'Licença maternidade'],
  },
  {
    numero: 8,
    ano: 2018,
    data: '2018-09-05',
    texto: 'A instituição de comissão por ato regulamentar do órgão central do Sistema de Pessoal Civil da Administração Federal (SIPEC) para verificação da veracidade da autodeclaração e a utilização do critério fenotípico como critério exclusivo encontra respaldo nos princípios da igualdade material, eficiência e transparência.',
    tags: ['AGU', 'CNU', 'ON CNU 08/2018', 'Heteroidentificação', 'SIPEC', 'Autodeclaração'],
  },
];

const AGU_ONS_URL = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(80));
  console.log('IMPORTAÇÃO DE ONs DA CNU (Câmara Nacional de Uniformização)');
  console.log('='.repeat(80));
  if (isDryRun) console.log('⚠️  MODO DRY RUN — nenhuma alteração será feita');
  console.log('');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const on of ONS_CNU) {
    const title = `Orientação Normativa CNU/CGU/AGU nº ${String(on.numero).padStart(2, '0')}/${on.ano}`;
    const description = on.observacao
      ? `${on.texto}\n\nOBS: ${on.observacao}`
      : on.texto;

    console.log(`\n📋 ${title}`);

    // Check for existing (by title match to avoid number/year collision with AGU ONs)
    const existing = await prisma.document.findFirst({
      where: {
        title,
        category: 'orientacao-normativa',
      },
    });

    if (existing) {
      console.log(`   ⏭️  Já existe (id: ${existing.id})`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`   🔍 Seria criado: ${title}`);
      console.log(`   📝 ${on.texto.slice(0, 100)}...`);
      created++;
      continue;
    }

    try {
      const doc = await prisma.document.create({
        data: {
          title,
          description,
          category: 'orientacao-normativa',
          type: 'link',
          url: AGU_ONS_URL,
          tags: JSON.stringify(on.tags),
          isPublic: true,
          isCommon: true,
          courseId: null,
          onNumber: on.numero,
          onYear: on.ano,
          reviewed: true,
        },
      });

      console.log(`   ✅ Criado (id: ${doc.id})`);
      created++;
    } catch (err) {
      console.error(`   ❌ Erro: ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTADO');
  console.log('='.repeat(80));
  console.log(`  Criados: ${created}`);
  console.log(`  Ignorados (já existiam): ${skipped}`);
  console.log(`  Erros: ${errors}`);
  console.log(`  Total ONs CNU: ${ONS_CNU.length}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
