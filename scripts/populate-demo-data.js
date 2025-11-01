/**
 * Script para popular o banco de dados com documentos de exemplo
 * Para gravação de vídeo de divulgação
 *
 * Uso: node scripts/populate-demo-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const documentosExemplo = [
  // ACÓRDÃOS TCU
  {
    title: 'Acórdão TCU nº 2622/2023 - Plenário',
    description: 'Dispensa de licitação. Contratação emergencial. Art. 75, VIII, da Lei 14.133/2021. Requisitos para caracterização de emergência. Prazo máximo de vigência.',
    category: 'acordao',
    type: 'link',
    url: 'https://pesquisa.apps.tcu.gov.br/',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['dispensa', 'emergencial', 'lei 14.133'])
  },
  {
    title: 'Acórdão TCU nº 1234/2023 - Plenário',
    description: 'Licitação. Modalidade pregão. Julgamento por maior desconto. Análise de propostas. Critérios de desempate. Aplicação da margem de preferência.',
    category: 'acordao',
    type: 'link',
    url: 'https://pesquisa.apps.tcu.gov.br/',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['pregão', 'desconto', 'desempate'])
  },
  {
    title: 'Acórdão TCU nº 3456/2023 - Segunda Câmara',
    description: 'Fiscalização de contratos. Gestão e fiscalização. Responsabilidade do gestor. Aplicação de penalidades. Inexecução parcial.',
    category: 'acordao',
    type: 'link',
    url: 'https://pesquisa.apps.tcu.gov.br/',
    courseId: '3',
    isPublic: false,
    tags: JSON.stringify(['fiscalização', 'gestor', 'penalidades'])
  },
  {
    title: 'Acórdão TCU nº 5678/2023 - Plenário',
    description: 'Planejamento de contratações. Estudo Técnico Preliminar. Requisitos mínimos. Pesquisa de preços. Orçamento estimado.',
    category: 'acordao',
    type: 'link',
    url: 'https://pesquisa.apps.tcu.gov.br/',
    courseId: '2',
    isPublic: false,
    tags: JSON.stringify(['planejamento', 'ETP', 'pesquisa de preços'])
  },

  // ORIENTAÇÕES NORMATIVAS AGU
  {
    title: 'Orientação Normativa AGU nº 58/2023',
    description: 'Dispõe sobre a aplicação da Lei nº 14.133/2021 no âmbito da Administração Pública Federal. Procedimentos licitatórios. Fase preparatória.',
    category: 'orientacao-normativa',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/orientacoes-normativas',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['AGU', 'lei 14.133', 'fase preparatória'])
  },
  {
    title: 'Orientação Normativa AGU nº 62/2024',
    description: 'Gestão e fiscalização de contratos administrativos. Papéis e responsabilidades. Registro de ocorrências. Medidas cabíveis em caso de irregularidades.',
    category: 'orientacao-normativa',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/orientacoes-normativas',
    courseId: '3',
    isPublic: false,
    tags: JSON.stringify(['gestão', 'fiscalização', 'contratos'])
  },
  {
    title: 'Orientação Normativa AGU nº 45/2022',
    description: 'Contratação direta. Hipóteses de dispensa e inexigibilidade. Requisitos formais. Documentação obrigatória. Ratificação pela autoridade competente.',
    category: 'orientacao-normativa',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/orientacoes-normativas',
    courseId: '10',
    isPublic: false,
    tags: JSON.stringify(['dispensa', 'inexigibilidade', 'contratação direta'])
  },

  // PARECERES AGU
  {
    title: 'Parecer AGU nº 123/2023/CONJUR-MEC',
    description: 'Análise sobre a possibilidade de prorrogação contratual além do prazo máximo previsto na Lei 14.133/2021. Hipóteses excepcionais. Motivação necessária.',
    category: 'parecer',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br',
    courseId: '9',
    isPublic: false,
    tags: JSON.stringify(['prorrogação', 'prazo', 'alterações contratuais'])
  },
  {
    title: 'Parecer AGU nº 456/2023/CONJUR-SAUDE',
    description: 'Terceirização de serviços. Caracterização de vínculo empregatício. Responsabilidade subsidiária da Administração. Jurisprudência do TST.',
    category: 'parecer',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br',
    courseId: '6',
    isPublic: false,
    tags: JSON.stringify(['terceirização', 'vínculo', 'responsabilidade'])
  },

  // APOSTILAS
  {
    title: 'Apostila - Nova Lei de Licitações - Parte 1',
    description: 'Material didático completo sobre os fundamentos da Lei 14.133/2021. Princípios, objetivos, campo de aplicação e estrutura geral da nova legislação.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/apostila-exemplo.pdf',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['apostila', 'lei 14.133', 'princípios'])
  },
  {
    title: 'Apostila - Planejamento de Contratações Públicas',
    description: 'Guia completo sobre planejamento estratégico de contratações. ETP, Análise de Riscos, Pesquisa de Preços, TR/PB e Orçamento Estimado.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/apostila-planejamento.pdf',
    courseId: '2',
    isPublic: false,
    tags: JSON.stringify(['planejamento', 'ETP', 'termo de referência'])
  },
  {
    title: 'Apostila - Gestão de Contratos Administrativos',
    description: 'Material sobre gestão e fiscalização de contratos. Papéis do gestor e fiscal. Registro de ocorrências. Aplicação de sanções.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/apostila-gestao.pdf',
    courseId: '3',
    isPublic: false,
    tags: JSON.stringify(['gestão', 'fiscalização', 'contratos'])
  },

  // ARTIGOS
  {
    title: 'A Inovação nas Contratações Públicas sob a Lei 14.133/2021',
    description: 'Artigo sobre as novas possibilidades de inovação trazidas pela nova lei de licitações. Encomendas Tecnológicas, Credenciamento e Procedimentos Auxiliares.',
    category: 'artigo',
    type: 'link',
    url: 'https://exemplo.com/artigo-inovacao',
    courseId: '5',
    isPublic: true,
    tags: JSON.stringify(['inovação', 'tecnologia', 'credenciamento'])
  },
  {
    title: 'Processo Administrativo Sancionador na Lei 14.133/2021',
    description: 'Análise detalhada do PAR (Processo Administrativo de Responsabilização). Fases, garantias, penalidades aplicáveis e recursos.',
    category: 'artigo',
    type: 'link',
    url: 'https://exemplo.com/artigo-par',
    courseId: '4',
    isPublic: true,
    tags: JSON.stringify(['PAR', 'sanções', 'penalidades'])
  },

  // EDITAIS
  {
    title: 'Modelo de Edital - Pregão Eletrônico para Aquisição de Bens',
    description: 'Modelo de edital de pregão eletrônico conforme Lei 14.133/2021. Inclui minutas de contratos, anexos técnicos e jurídicos.',
    category: 'edital',
    type: 'pdf',
    url: '/uploads/modelo-edital-pregao.pdf',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['modelo', 'pregão', 'edital'])
  },
  {
    title: 'Modelo de Termo de Referência - Serviços de TI',
    description: 'Modelo completo de Termo de Referência para contratação de serviços de tecnologia da informação. Níveis de serviço, métricas e fiscalização.',
    category: 'edital',
    type: 'pdf',
    url: '/uploads/modelo-tr-ti.pdf',
    courseId: '2',
    isPublic: false,
    tags: JSON.stringify(['termo de referência', 'TI', 'serviços'])
  },

  // JURISPRUDÊNCIA
  {
    title: 'Súmula TCU nº 286 - Reajuste e Repactuação',
    description: 'Reajuste de preços em contratos de obras e serviços. Diferenças entre reajuste, revisão e repactuação. Índices aplicáveis.',
    category: 'outro',
    type: 'link',
    url: 'https://portal.tcu.gov.br/jurisprudencia/sumulas-tcu/',
    courseId: '8',
    isPublic: false,
    tags: JSON.stringify(['súmula', 'reajuste', 'repactuação'])
  },

  // DOCUMENTOS PÚBLICOS (para a página inicial)
  {
    title: 'Guia Rápido - Lei 14.133/2021',
    description: 'Guia de bolso com os principais pontos da Nova Lei de Licitações. Modalidades, critérios de julgamento, prazos e procedimentos.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/guia-rapido.pdf',
    courseId: '1',
    isPublic: true,
    tags: JSON.stringify(['guia', 'lei 14.133', 'resumo'])
  },
  {
    title: 'Checklist - Planejamento de Contratações',
    description: 'Lista de verificação completa para a fase de planejamento. ETP, Análise de Riscos, Pesquisa de Preços, TR/PB.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/checklist-planejamento.pdf',
    courseId: '2',
    isPublic: true,
    tags: JSON.stringify(['checklist', 'planejamento', 'ETP'])
  },

  // MAIS DOCUMENTOS PARA OUTROS CURSOS
  {
    title: 'Alterações Contratuais - Acréscimos e Supressões',
    description: 'Limites percentuais para alterações contratuais. Requisitos formais. Necessidade de justificativa e autorização. Jurisprudência aplicável.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/alteracoes-contratuais.pdf',
    courseId: '9',
    isPublic: false,
    tags: JSON.stringify(['alterações', 'acréscimos', 'supressões'])
  },
  {
    title: 'Formação de Preços em Contratos de Terceirização',
    description: 'Metodologia para formação e análise de planilhas de custos. Encargos sociais, benefícios, insumos e lucro. Conformidade com normativas.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/formacao-precos.pdf',
    courseId: '6',
    isPublic: false,
    tags: JSON.stringify(['preços', 'terceirização', 'planilha'])
  },
  {
    title: 'Assessoramento Jurídico - Papel da Consultoria Jurídica',
    description: 'Atribuições da consultoria jurídica nos procedimentos licitatórios. Análise prévia de editais. Manifestação sobre recursos. Pareceres obrigatórios.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/assessoramento-juridico.pdf',
    courseId: '7',
    isPublic: false,
    tags: JSON.stringify(['consultoria', 'jurídico', 'pareceres'])
  },
];

async function main() {
  console.log('🚀 Iniciando população do banco de dados com documentos de exemplo...\n');

  try {
    // Limpar documentos existentes (opcional - descomente se quiser resetar)
    // await prisma.document.deleteMany({});
    // console.log('✅ Documentos existentes removidos\n');

    // Inserir documentos de exemplo
    console.log('📚 Inserindo documentos de exemplo...\n');

    for (const doc of documentosExemplo) {
      const created = await prisma.document.create({
        data: doc
      });
      console.log(`✓ Criado: ${created.title}`);
    }

    console.log('\n✅ Total de documentos inseridos:', documentosExemplo.length);

    // Estatísticas por categoria
    console.log('\n📊 ESTATÍSTICAS POR CATEGORIA:\n');

    const categorias = ['acordao', 'orientacao-normativa', 'parecer', 'apostila', 'artigo', 'edital', 'outro'];

    for (const cat of categorias) {
      const count = await prisma.document.count({
        where: { category: cat }
      });

      const nomes = {
        'acordao': 'Acórdãos TCU',
        'orientacao-normativa': 'Orientações Normativas',
        'parecer': 'Pareceres',
        'apostila': 'Apostilas',
        'artigo': 'Artigos',
        'edital': 'Editais/Modelos',
        'outro': 'Outros'
      };

      console.log(`   ${nomes[cat]}: ${count} documentos`);
    }

    // Estatísticas por curso
    console.log('\n📚 DOCUMENTOS POR CURSO:\n');

    const cursos = [
      { id: '1', nome: 'Nova Lei de Licitações' },
      { id: '2', nome: 'Planejamento das Contratações' },
      { id: '3', nome: 'Gestão e Fiscalização de Contratos' },
      { id: '4', nome: 'Processo Administrativo Sancionador' },
      { id: '5', nome: 'Inovação nas Contratações' },
      { id: '6', nome: 'Terceirização e Formação de Preços' },
      { id: '7', nome: 'Assessoramento Jurídico' },
      { id: '8', nome: 'Revisão, Reajuste e Repactuação' },
      { id: '9', nome: 'Alterações Contratuais' },
      { id: '10', nome: 'Contratação Direta' },
    ];

    for (const curso of cursos) {
      const count = await prisma.document.count({
        where: { courseId: curso.id }
      });

      if (count > 0) {
        console.log(`   ${curso.nome}: ${count} documentos`);
      }
    }

    // Documentos públicos
    const publicos = await prisma.document.count({
      where: { isPublic: true }
    });

    console.log(`\n🌐 Documentos públicos: ${publicos}`);
    console.log(`🔒 Documentos restritos: ${documentosExemplo.length - publicos}`);

    console.log('\n✨ População concluída com sucesso!');
    console.log('\n💡 Dica: Acesse http://localhost:3000/area-restrita para ver os documentos');

  } catch (error) {
    console.error('❌ Erro ao popular banco de dados:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
