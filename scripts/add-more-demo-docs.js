/**
 * Script para adicionar mais documentos variados
 * Para deixar a demonstração mais completa
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const maisDocumentos = [
  // Mais Acórdãos
  {
    title: 'Acórdão TCU nº 789/2024 - Primeira Câmara',
    description: 'Contratação integrada. Projetos básico e executivo. Responsabilidade técnica. Regime de execução por empreitada.',
    category: 'acordao',
    type: 'link',
    url: 'https://pesquisa.apps.tcu.gov.br/',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['contratação integrada', 'projeto', 'empreitada'])
  },
  {
    title: 'Acórdão TCU nº 1567/2024 - Plenário',
    description: 'Diálogo competitivo. Procedimento auxiliar. Contratações complexas. Participação de licitantes na definição de requisitos.',
    category: 'acordao',
    type: 'link',
    url: 'https://pesquisa.apps.tcu.gov.br/',
    courseId: '5',
    isPublic: false,
    tags: JSON.stringify(['diálogo competitivo', 'inovação', 'complexidade'])
  },

  // Mais Pareceres
  {
    title: 'Parecer AGU nº 234/2024/CONJUR-INFRAESTRUTURA',
    description: 'Reequilíbrio econômico-financeiro. Teoria da imprevisão. Fatos imprevisíveis. Cálculo da onerosidade excessiva. Comprovação documental.',
    category: 'parecer',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br',
    courseId: '8',
    isPublic: false,
    tags: JSON.stringify(['reequilíbrio', 'revisão', 'onerosidade'])
  },
  {
    title: 'Parecer AGU nº 567/2024/CONJUR-JUSTICA',
    description: 'Sanções administrativas. Impedimento de licitar. Declaração de inidoneidade. Prescrição. Direito de defesa e contraditório.',
    category: 'parecer',
    type: 'link',
    url: 'https://www.gov.br/agu/pt-br',
    courseId: '4',
    isPublic: false,
    tags: JSON.stringify(['sanções', 'impedimento', 'defesa'])
  },

  // Mais Apostilas
  {
    title: 'Apostila - Contratação Direta Completa',
    description: 'Guia completo sobre dispensa e inexigibilidade de licitação. Hipóteses legais. Procedimentos formais. Ratificação. Jurisprudência.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/apostila-contratacao-direta.pdf',
    courseId: '10',
    isPublic: false,
    tags: JSON.stringify(['dispensa', 'inexigibilidade', 'procedimentos'])
  },
  {
    title: 'Apostila - Processo Administrativo Sancionador',
    description: 'Material completo sobre o PAR. Instauração, instrução, defesa, julgamento e recursos. Penalidades aplicáveis e seus efeitos.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/apostila-par.pdf',
    courseId: '4',
    isPublic: false,
    tags: JSON.stringify(['PAR', 'processo', 'sanções'])
  },

  // Mais Artigos
  {
    title: 'Sustentabilidade nas Licitações Públicas',
    description: 'Como incorporar critérios de sustentabilidade ambiental e social nas contratações públicas. Licitações verdes. Economia circular.',
    category: 'artigo',
    type: 'link',
    url: 'https://exemplo.com/artigo-sustentabilidade',
    courseId: '5',
    isPublic: true,
    tags: JSON.stringify(['sustentabilidade', 'meio ambiente', 'social'])
  },
  {
    title: 'Compliance em Contratos Públicos',
    description: 'Programas de integridade. Lei Anticorrupção. Responsabilização de empresas. Acordo de leniência. Due diligence.',
    category: 'artigo',
    type: 'link',
    url: 'https://exemplo.com/artigo-compliance',
    courseId: '3',
    isPublic: true,
    tags: JSON.stringify(['compliance', 'integridade', 'anticorrupção'])
  },

  // Modelos e Editais
  {
    title: 'Modelo de Contrato - Prestação de Serviços Continuados',
    description: 'Minuta de contrato para serviços continuados com dedicação exclusiva de mão de obra. Cláusulas essenciais. Gestão e fiscalização.',
    category: 'edital',
    type: 'pdf',
    url: '/uploads/modelo-contrato-servicos.pdf',
    courseId: '6',
    isPublic: false,
    tags: JSON.stringify(['contrato', 'serviços', 'modelo'])
  },
  {
    title: 'Checklist - Análise de Propostas',
    description: 'Lista de verificação para análise de propostas comerciais e técnicas. Conformidade com edital. Critérios de aceitabilidade.',
    category: 'edital',
    type: 'pdf',
    url: '/uploads/checklist-propostas.pdf',
    courseId: '1',
    isPublic: false,
    tags: JSON.stringify(['checklist', 'propostas', 'análise'])
  },

  // Legislação e Jurisprudência
  {
    title: 'Lei 14.133/2021 - Texto Consolidado e Anotado',
    description: 'Texto completo da Nova Lei de Licitações com anotações, referências cruzadas e jurisprudência relevante.',
    category: 'outro',
    type: 'pdf',
    url: '/uploads/lei-14133-anotada.pdf',
    courseId: '1',
    isPublic: true,
    tags: JSON.stringify(['lei 14.133', 'legislação', 'anotada'])
  },
  {
    title: 'Decreto 11.462/2023 - Regulamentação da Lei 14.133/2021',
    description: 'Decreto regulamentar da Nova Lei de Licitações. Procedimentos operacionais. Portal Nacional de Contratações Públicas.',
    category: 'outro',
    type: 'link',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11462.htm',
    courseId: '1',
    isPublic: true,
    tags: JSON.stringify(['decreto', 'regulamentação', 'PNCP'])
  },

  // Casos Práticos
  {
    title: 'Caso Prático 01 - Licitação Fracassada',
    description: 'Análise de caso real: licitação fracassada. Causas. Medidas a adotar. Nova licitação ou contratação direta? Justificativas necessárias.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/caso-pratico-01.pdf',
    courseId: '10',
    isPublic: false,
    tags: JSON.stringify(['caso prático', 'fracasso', 'dispensa'])
  },
  {
    title: 'Caso Prático 02 - Glosa de Itens em Medição',
    description: 'Estudo de caso: glosa de itens na medição mensal. Procedimentos do fiscal. Direito de defesa da contratada. Aplicação de penalidades.',
    category: 'apostila',
    type: 'pdf',
    url: '/uploads/caso-pratico-02.pdf',
    courseId: '3',
    isPublic: false,
    tags: JSON.stringify(['caso prático', 'medição', 'glosa'])
  },

  // Formulários e Ferramentas
  {
    title: 'Formulário - Registro de Ocorrências',
    description: 'Modelo de formulário para registro de ocorrências na execução contratual. Não conformidades. Advertências. Documentação para PAR.',
    category: 'edital',
    type: 'pdf',
    url: '/uploads/formulario-ocorrencias.pdf',
    courseId: '3',
    isPublic: false,
    tags: JSON.stringify(['formulário', 'ocorrências', 'fiscalização'])
  },
  {
    title: 'Planilha - Pesquisa de Preços',
    description: 'Planilha Excel para consolidação de pesquisa de preços. Cálculo de preço médio, mediana e valor de referência.',
    category: 'edital',
    type: 'pdf',
    url: '/uploads/planilha-pesquisa-precos.xlsx',
    courseId: '2',
    isPublic: false,
    tags: JSON.stringify(['planilha', 'pesquisa', 'preços'])
  },
];

async function main() {
  console.log('📚 Adicionando mais documentos de exemplo...\n');

  try {
    for (const doc of maisDocumentos) {
      const created = await prisma.document.create({
        data: doc
      });
      console.log(`✓ Criado: ${created.title}`);
    }

    console.log('\n✅ Mais', maisDocumentos.length, 'documentos adicionados!');

    // Total geral
    const total = await prisma.document.count();
    console.log('\n📊 TOTAL GERAL DE DOCUMENTOS:', total);

    console.log('\n✨ Banco de dados está pronto para a gravação do vídeo!');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
