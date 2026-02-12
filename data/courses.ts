import { Course } from '@/lib/types';

export const courses: Course[] = [
  {
    id: '2',
    slug: 'planejamento-contratacoes',
    title: 'Planejamento das Contratações Públicas',
    shortDescription: 'Metodologia completa para planejamento eficiente de contratações públicas.',
    description: `
      Curso focado na fase de planejamento das contratações públicas, abordando desde o Plano de
      Contratações Anual (PCA) até a elaboração do Estudo Técnico Preliminar (ETP), Termo de Referência
      e Projeto Básico.
      
      Inclui modelos práticos, check-lists e análise de casos reais de sucesso e fracasso no
      planejamento de contratações.
    `,
    bibliography: [
      'BRASIL. Instrução Normativa SEGES/ME nº 40/2020 - Elaboração dos Estudos Técnicos Preliminares.',
      'TCU. Acórdão 2.622/2015 - Plenário. Planejamento de Contratações.',
      'AGU. Manual de Boas Práticas em Contratação de Soluções de TI. Brasília: AGU, 2023.',
      'SANTANA, Jair Eduardo. Planejamento nas Licitações e Contratos. 2ª ed. Curitiba: Zênite, 2023.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    slug: 'gestao-fiscalizacao-contratos',
    title: 'Gestão e Fiscalização de Contratos Administrativos',
    shortDescription: 'Técnicas e ferramentas para gestão e fiscalização eficaz de contratos.',
    description: `
      Curso completo sobre gestão e fiscalização de contratos administrativos, abordando as
      responsabilidades do gestor e fiscal, procedimentos de acompanhamento, medição, pagamento
      e aplicação de sanções administrativas.
      
      Material rico em modelos de documentos, relatórios e ferramentas de controle.
    `,
    bibliography: [
      'BRASIL. Instrução Normativa SEGES/ME nº 05/2017 - Regras e diretrizes para contratação de serviços.',
      'TCU. Manual de Gestão e Fiscalização de Contratos. Brasília: TCU, 2023.',
      'VIEIRA, Antonieta Pereira. Manual de Gestão e Fiscalização de Contratos. 4ª ed. Belo Horizonte: Fórum, 2023.',
      'CGU. Cartilha Gestão de Contratos. Brasília: CGU, 2023.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '4',
    slug: 'processo-sancionador',
    title: 'Processo Administrativo Sancionador',
    shortDescription: 'Condução adequada de processos administrativos sancionadores.',
    description: `
      Curso sobre a condução de processos administrativos sancionadores, desde a instauração até a
      aplicação da penalidade, observando os princípios do contraditório, ampla defesa e devido
      processo legal.
      
      Inclui modelos de peças processuais, prazos e análise de casos do TCU.
    `,
    bibliography: [
      'FERRAZ, Sérgio; DALLARI, Adilson Abreu. Processo Administrativo. 4ª ed. São Paulo: Malheiros, 2023.',
      'BACELLAR FILHO, Romeu Felipe. Processo Administrativo Disciplinar. 5ª ed. São Paulo: Saraiva, 2023.',
      'TCU. Acórdão 1.970/2023 - Plenário. Aplicação de Sanções Administrativas.',
      'AGU. Parecer nº 00001/2023/CNMLC/CGU/AGU - Processo Administrativo Sancionador.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '7',
    slug: 'assessoramento-juridico',
    title: 'Assessoramento Jurídico em Licitações',
    shortDescription: 'Atuação consultiva e parecer jurídico nos processos licitatórios.',
    description: `
      Curso direcionado aos procuradores e assessores jurídicos sobre a atuação consultiva em
      licitações e contratos, elaboração de pareceres jurídicos, análise de riscos e orientação
      preventiva.
      
      Aborda a responsabilidade do parecerista e as melhores práticas de assessoramento jurídico.
    `,
    bibliography: [
      'BRASIL. Lei nº 14.133/2021 - Arts. 53 a 55.',
      'AGU. Manual de Boas Práticas Consultivas. Brasília: AGU, 2023.',
      'MOREIRA NETO, Diogo de Figueiredo. Consultoria Jurídica da Administração Pública. 2ª ed. Belo Horizonte: Fórum, 2023.',
      'TCU. Acórdão 2.993/2023 - Plenário. Responsabilidade do Parecerista.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 4,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '8',
    slug: 'revisao-reajuste-repactuacao',
    title: 'Revisão, Reajuste e Repactuação',
    shortDescription: 'Mecanismos de reequilíbrio econômico-financeiro dos contratos.',
    description: `
      Curso sobre os mecanismos de manutenção do equilíbrio econômico-financeiro dos contratos
      administrativos: revisão, reajuste e repactuação. Diferenças, requisitos, procedimentos
      e cálculos.
      
      Inclui casos práticos, modelos de planilhas e análise da jurisprudência do TCU.
    `,
    bibliography: [
      'BRASIL. Lei nº 14.133/2021 - Arts. 124 a 136.',
      'MEIRELLES, Hely Lopes. Direito Administrativo Brasileiro. 49ª ed. São Paulo: Malheiros, 2023.',
      'TCU. Acórdão 1.563/2023 - Plenário. Reequilíbrio Econômico-Financeiro.',
      'AGU. Parecer nº 00002/2023/CNMLC/CGU/AGU - Repactuação de Contratos.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '9',
    slug: 'alteracoes-contratuais',
    title: 'Alterações Contratuais',
    shortDescription: 'Limites e procedimentos para alterações contratuais na Administração Pública.',
    description: `
      Curso sobre alterações contratuais unilaterais e bilaterais, limites quantitativos e
      qualitativos, acréscimos e supressões, e procedimentos para formalização das alterações.
      
      Análise detalhada dos limites legais e casos excepcionais reconhecidos pela jurisprudência.
    `,
    bibliography: [
      'BRASIL. Lei nº 14.133/2021 - Arts. 124 a 136.',
      'JUSTEN FILHO, Marçal. Curso de Direito Administrativo. 14ª ed. São Paulo: Thomson Reuters, 2023.',
      'TCU. Súmula 259 - Alterações Contratuais.',
      'AGU. Orientação Normativa nº 50 - Alterações Contratuais.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 6,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '10',
    slug: 'contratacao-direta',
    title: 'Contratação Direta',
    shortDescription: 'Dispensa e inexigibilidade de licitação - requisitos e procedimentos.',
    description: `
      Curso completo sobre contratação direta, abordando todas as hipóteses de dispensa e
      inexigibilidade de licitação, requisitos legais, procedimentos, justificativas e
      formalização.
      
      Inclui análise de casos práticos e jurisprudência consolidada do TCU.
    `,
    bibliography: [
      'BRASIL. Lei nº 14.133/2021 - Arts. 72 a 75.',
      'NIEBUHR, Joel de Menezes. Dispensa e Inexigibilidade de Licitação Pública. 5ª ed. Curitiba: Zênite, 2023.',
      'TCU. Orientações para Contratações Diretas. Brasília: TCU, 2023.',
      'AGU. Orientação Normativa nº 54 - Contratação Direta.',
    ],
    publicDocuments: [],
    restrictedDocuments: [],
    order: 7,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];