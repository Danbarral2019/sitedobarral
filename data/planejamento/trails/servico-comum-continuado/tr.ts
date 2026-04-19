/**
 * Trilha TR — Serviço Comum Continuado.
 *
 * Cobre os elementos do Termo de Referência para serviços comuns de natureza
 * continuada, com fundamento no art. 6º, XXIII e no art. 40 da Lei 14.133/2021,
 * observadas a IN SEGES/ME 81/2022 (serviços em geral, inclusive continuados
 * com dedicação exclusiva de mão de obra) e a IN SEGES 65/2021 (pesquisa de
 * preços).
 *
 * Seções com `derivesFromSectionKey` são pré-carregadas pelo engine de
 * herança (lib/planejamento/session-manager.materializeTR) a partir das
 * respectivas seções do ETP da mesma sessão.
 */
import type { TrailDefinition } from "../../types";

export const servicoComumContinuadoTr: TrailDefinition = {
  slug: "servico-comum-continuado-tr",
  natureza: "SERVICO_CONTINUADO",
  documentType: "TR",
  version: 1,
  title: "TR — Serviço Comum Continuado",
  description:
    "Trilha de Termo de Referência para contratação de serviços comuns de natureza continuada, com fundamento no art. 6º, XXIII, no art. 40 da Lei 14.133/2021 e na IN SEGES/ME 81/2022.",
  sections: [
    {
      key: "objeto",
      title: "Objeto da contratação",
      shortLabel: "Objeto",
      ordem: 1,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 6º, XXIII, a", articleNumber: "6" },
        { kind: "in", label: "IN SEGES/ME 81/2022, art. 5º" },
      ],
      didactic: {
        conceito:
          "Definição precisa, suficiente e clara do objeto a ser contratado, incluindo quantidades e indicação de natureza continuada.",
        fundamento:
          "Art. 6º, XXIII, a. O objeto do TR decorre do ETP e é redigido de forma a permitir a formulação de propostas isonômicas.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["tr", "objeto"],
        minSimilarity: 0.55,
        limit: 8,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        derivesFromSectionKey: "descricao-solucao",
        userTemplate:
          "Redija a descrição do objeto do TR para {{descricaoLivre}}, em prosa, incorporando as definições consolidadas no ETP (solução escolhida e estimativa de quantidades) e sinalizando a natureza continuada do serviço.",
      },
      sufficiencyHeuristicRefs: ["minWords:100"],
    },

    {
      key: "justificativa",
      title: "Justificativa e fundamentação da contratação",
      shortLabel: "Justificativa",
      ordem: 2,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 6º, XXIII, b", articleNumber: "6" },
      ],
      didactic: {
        conceito:
          "Explicitação da necessidade pública e dos motivos que orientam a contratação, em decorrência do ETP.",
        fundamento: "Art. 6º, XXIII, b. Deve referenciar os achados do ETP sem duplicá-lo.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["tr", "justificativa"],
        minSimilarity: 0.55,
        limit: 8,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        derivesFromSectionKey: "descricao-necessidade",
        userTemplate:
          "Elabore a justificativa e fundamentação do TR para {{descricaoLivre}}, em prosa, articulando a necessidade pública com os resultados pretendidos e com o alinhamento estratégico já consignados no ETP.",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "descricao-solucao-tr",
      title: "Descrição da solução como um todo",
      shortLabel: "Solução",
      ordem: 3,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 6º, XXIII, c", articleNumber: "6" },
      ],
      didactic: {
        conceito:
          "Apresentação integrada da solução, considerando ciclo de vida, padrões técnicos, aspectos operacionais e, quando aplicável, sustentabilidade.",
        fundamento: "Art. 6º, XXIII, c. Consolida o que foi deliberado no ETP.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["tr", "solucao"],
        minSimilarity: 0.55,
        limit: 8,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        derivesFromSectionKey: "descricao-solucao",
        userTemplate:
          "Descreva a solução do TR para {{descricaoLivre}}, em prosa, enfatizando ciclo de vida, padrões técnicos e aspectos operacionais pertinentes à execução continuada.",
      },
      sufficiencyHeuristicRefs: ["minWords:100"],
    },

    {
      key: "requisitos-tr",
      title: "Requisitos da contratação",
      shortLabel: "Requisitos",
      ordem: 4,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 6º, XXIII, d", articleNumber: "6" },
        { kind: "in", label: "IN SEGES/ME 81/2022, art. 7º" },
      ],
      didactic: {
        conceito:
          "Requisitos técnicos, funcionais, de qualidade, de segurança e de sustentabilidade aplicáveis.",
        fundamento:
          "Art. 6º, XXIII, d. Requisitos objetivos e verificáveis, sem gerar restrição indevida à competitividade (art. 11).",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["tr", "requisitos"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        derivesFromSectionKey: "requisitos-contratacao",
        userTemplate:
          "Consolide, em prosa, os requisitos da contratação {{descricaoLivre}}, refinando o que foi estabelecido no ETP e acrescentando exigências específicas para execução continuada (uniformização, equipamentos mínimos, reposição de pessoal).",
      },
      sufficiencyHeuristicRefs: ["minWords:150"],
    },

    {
      key: "modelo-execucao",
      title: "Modelo de execução do objeto",
      shortLabel: "Execução",
      ordem: 5,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 40, II", articleNumber: "40" },
        { kind: "in", label: "IN SEGES/ME 81/2022, art. 8º" },
      ],
      didactic: {
        conceito:
          "Dinâmica de execução: locais, horários, rotinas, equipamentos, uniformes, procedimentos de substituição e instrumentos de controle.",
        fundamento:
          "Art. 40, II. Em serviços continuados com dedicação exclusiva, detalhar o enquadramento da CCT/ACT aplicável.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["tr", "execucao", "IN-81-2022"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Descreva o modelo de execução do objeto para {{descricaoLivre}}, em prosa, contemplando locais, rotinas, equipamentos, regime de dedicação de mão de obra quando aplicável, uniformes e procedimentos de substituição de pessoal.",
      },
      sufficiencyHeuristicRefs: ["minWords:150"],
    },

    {
      key: "modelo-gestao",
      title: "Modelo de gestão do contrato",
      shortLabel: "Gestão",
      ordem: 6,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 40, VIII", articleNumber: "40" },
        { kind: "in", label: "IN SEGES/ME 81/2022, art. 9º" },
      ],
      didactic: {
        conceito:
          "Papéis do gestor, fiscais técnico, administrativo e setoriais; rotinas de fiscalização; instrumentos de controle (IMR, checklists, relatórios).",
        fundamento: "Art. 40, VIII.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["tr", "fiscalizacao", "IN-81-2022"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Descreva o modelo de gestão do contrato para {{descricaoLivre}}, em prosa, estabelecendo papéis (gestor e fiscais), rotinas de fiscalização, instrumentos de controle e periodicidade dos relatórios.",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "medicao-pagamento",
      title: "Critérios de medição e pagamento",
      shortLabel: "Medição/Pagamento",
      ordem: 7,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 40, X e art. 143", articleNumber: "40" },
        { kind: "in", label: "IN SEGES/ME 81/2022, art. 10" },
      ],
      didactic: {
        conceito:
          "Indicadores de resultado (IMR), glosas, prazos de pagamento e condicionantes de aceitação.",
        fundamento:
          "Art. 40, X. Em serviços continuados, é recomendado o IMR (Instrumento de Medição de Resultado) associando desconto à qualidade verificada.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["tr", "medicao", "imr"],
        minSimilarity: 0.55,
        limit: 8,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Apresente os critérios de medição e pagamento para {{descricaoLivre}}, em prosa, incluindo o instrumento de medição de resultados (IMR) quando pertinente, condicionantes de aceitação, glosas e prazos.",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "criterios-selecao",
      title: "Forma e critérios de seleção do fornecedor",
      shortLabel: "Seleção",
      ordem: 8,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, arts. 28 a 33", articleNumber: "28" },
      ],
      didactic: {
        conceito:
          "Modalidade, critério de julgamento, regime de execução, exigências de habilitação e critérios técnicos de desempate.",
        fundamento:
          "Arts. 28 a 33 da Lei 14.133/2021. A escolha deve decorrer da matriz de decisão executada na sessão.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["tr", "modalidade", "habilitacao"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        requiresMatrix: true,
        userTemplate:
          "Consolide os critérios de seleção para {{descricaoLivre}}, em prosa, descrevendo modalidade, critério de julgamento, regime de execução e requisitos de habilitação compatíveis com o objeto, refletindo o resultado da matriz de decisão da sessão.",
      },
      sufficiencyHeuristicRefs: ["minWords:150"],
    },

    {
      key: "estimativa-valor-tr",
      title: "Estimativa do valor da contratação",
      shortLabel: "Valor",
      ordem: 9,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 23 e art. 40, V", articleNumber: "23" },
        { kind: "in", label: "IN SEGES 65/2021" },
      ],
      didactic: {
        conceito:
          "Valor estimado total e memória de cálculo. Em serviços continuados, planilha de composição de custos quando há dedicação exclusiva de mão de obra.",
        fundamento: "Art. 23 e art. 40, V.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["tr", "valor", "IN-65-2021"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        derivesFromSectionKey: "estimativa-valor",
        userTemplate:
          "Apresente a estimativa do valor da contratação para {{descricaoLivre}}, em prosa, preservando a metodologia consignada no ETP e indicando, quando cabível, a existência de planilha de composição de custos em anexo.",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "adequacao-orcamentaria",
      title: "Adequação orçamentária",
      shortLabel: "Orçamento",
      ordem: 10,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 40, X", articleNumber: "40" },
        { kind: "lei", label: "LRF, art. 16", articleNumber: "16" },
      ],
      didactic: {
        conceito:
          "Programa de trabalho, elemento de despesa, plano plurianual, lei orçamentária e declaração do ordenador.",
        fundamento:
          "Art. 40, X, combinado com a LRF. Em serviços continuados por prazo superior a um exercício, indicar previsão nos exercícios seguintes.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["tr", "orcamento", "lrf"],
        minSimilarity: 0.5,
        limit: 6,
      },
      promptSpec: {
        systemRef: "tr.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Descreva a adequação orçamentária da contratação {{descricaoLivre}}, em prosa, indicando programa de trabalho, elemento de despesa, fonte e declaração do ordenador sobre a existência de recursos.",
      },
      sufficiencyHeuristicRefs: ["minWords:80"],
    },
  ],
};

export default servicoComumContinuadoTr;
