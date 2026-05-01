/**
 * Conserta URLs de enunciados CJF/IBDA que retornam 404 + importa 11
 * enunciados INCP da 2ª edição (44-54) que faltam no banco.
 *
 * URLs atualizadas:
 * - CJF .../jornadas-de-direito-administrativo (404) →
 *       .../jornadas-enunciados (200) — 54 docs
 * - IBDA .../noticias/resultado-da-iii-jornada-de-direito-administrativo-2024 (404) →
 *       https://ibda.com.br/jornada-2024/ (200) — 61 docs
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';

const URL_FIXES = [
  {
    from: 'https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/jornadas-de-direito-administrativo',
    to: 'https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/jornadas-enunciados',
  },
  {
    from: 'https://www.ibda.com.br/noticias/resultado-da-iii-jornada-de-direito-administrativo-2024',
    to: 'https://ibda.com.br/jornada-2024/',
  },
];

const INCP_2A_EDICAO_URL = 'https://incpbrasil.com.br/informativo-enunciados-2a-edicao/';

interface IncpEnunciado {
  numero: number;
  texto: string;
}

const INCP_44_54: IncpEnunciado[] = [
  { numero: 44, texto: 'A ausência de previsão no edital não impede a autorização excepcional da subcontratação em contratos regidos pela Lei 13.303/2016, no caso de fato superveniente, observado o dever de motivação. (Aprovado por unanimidade)' },
  { numero: 45, texto: 'O fiscal e o gestor do contrato devem adotar postura colaborativa e dialógica com o contratado, buscando prevenir conflitos, mediante reuniões periódicas e tratativas formais para solução de problemas que envolvam a execução contratual. (Aprovado por unanimidade)' },
  { numero: 46, texto: 'A Lei 14.133/2021 não obriga a adoção de dispensa eletrônica. (Aprovado por unanimidade)' },
  { numero: 47, texto: 'Considerando que a Lei 13.303/2016 não estabelece critérios específicos para a dosimetria das sanções aplicáveis pelas estatais, admite-se que os regulamentos internos definam aspectos objetivos — tais como reincidência, gravidade da conduta e prejuízo causado — para a fixação da pena, observados os princípios da proporcionalidade e da motivação. (Aprovado por unanimidade)' },
  { numero: 48, texto: 'Os instrumentos hábeis a substituir o termo de contrato sujeitam-se às normas de contratos administrativos. (Aprovado por unanimidade)' },
  { numero: 49, texto: 'A verificação de informações e documentos pelo agente público diretamente nos sítios eletrônicos oficiais de órgãos e entidades, desde que atestado nos autos, constitui meio legal de prova para todos os fins de direito. (Aprovado por unanimidade)' },
  { numero: 50, texto: 'A omissão no dever de implementar a governança das contratações poderá ensejar responsabilização aos membros da alta administração de órgãos e entidades da Administração Pública. (Aprovado por unanimidade)' },
  { numero: 51, texto: 'Caso não seja realizada, durante o certame, a análise da proposta e da habilitação dos fornecedores incluídos no cadastro reserva do sistema de registro de preços, caberá a interposição de recurso administrativo no momento em que houver eventual convocação posterior à homologação. (Aprovado por unanimidade)' },
  { numero: 52, texto: 'A adoção do orçamento sigiloso não afasta o dever de indicar a data do orçamento estimado no instrumento convocatório, para fins de definição da data-base para o reajustamento em sentido estrito. (Aprovado por unanimidade)' },
  { numero: 53, texto: 'Nas pesquisas de preços para obras e serviços de engenharia, é admissível a cotação com potenciais fornecedores, como fonte de preço subsidiária, caso esgotados os parâmetros previstos no art. 23, § 2º, da Lei 14.133/2021. (Aprovado por unanimidade)' },
  { numero: 54, texto: 'A previsão de regulamento do Poder Executivo federal no inciso VII do § 1º do art. 79 da Lei 14.133/2021 não impede a edição de regulamento pelos demais entes federativos e demais órgãos independentes da Administração Pública para a contratação direta de serviços de manutenção e conserto de bens, equipamentos e veículos cuja contratação dependa, por sua natureza, da escolha do prestador, observados os princípios da publicidade, da eficiência e da economicidade. (Aprovado por unanimidade)' },
];

async function main() {
  const apply = process.argv.includes('--apply');

  // Parte 1: atualizar URLs
  console.log(`📋 Parte 1: atualizar URLs (${apply ? 'APPLY' : 'dry-run'})\n`);
  for (const fix of URL_FIXES) {
    const docs = await prisma.document.findMany({
      where: { category: 'enunciados', url: fix.from },
      select: { id: true, title: true },
    });
    console.log(`   ${docs.length} docs com URL antiga ${fix.from}`);
    console.log(`   → ${fix.to}`);
    if (apply && docs.length > 0) {
      await prisma.document.updateMany({
        where: { category: 'enunciados', url: fix.from },
        data: { url: fix.to },
      });
      console.log(`   💾 ${docs.length} updates aplicados`);
    }
    console.log();
  }

  // Parte 2: importar INCP 44-54
  console.log(`\n📋 Parte 2: importar 11 enunciados INCP 44-54 da 2ª edição\n`);
  const existingTitles = await prisma.document.findMany({
    where: { category: 'enunciados', title: { in: INCP_44_54.map((e) => `Enunciado do INCP nº ${e.numero}`) } },
    select: { title: true },
  });
  const existing = new Set(existingTitles.map((d) => d.title));
  console.log(`   Já existem: ${existing.size}/${INCP_44_54.length}`);

  const toCreate = INCP_44_54.filter((e) => !existing.has(`Enunciado do INCP nº ${e.numero}`));
  console.log(`   A criar: ${toCreate.length}`);
  for (const e of toCreate) {
    console.log(`     INCP nº ${e.numero}: ${e.texto.slice(0, 60)}...`);
  }

  if (apply && toCreate.length > 0) {
    for (const e of toCreate) {
      await prisma.document.create({
        data: {
          title: `Enunciado do INCP nº ${e.numero}`,
          description: e.texto,
          content: e.texto,
          category: 'enunciados',
          type: 'link',
          url: INCP_2A_EDICAO_URL,
          isPublic: true,
          isCommon: true,
        },
      });
    }
    console.log(`   💾 ${toCreate.length} criados.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
