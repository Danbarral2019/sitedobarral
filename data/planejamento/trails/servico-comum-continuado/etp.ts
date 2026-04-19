/**
 * Trilha ETP — Serviço Comum Continuado (fatia vertical de validação do MVP).
 *
 * Cobre os incisos do art. 18 §1º da Lei 14.133/2021 aplicáveis a serviços
 * comuns continuados, com observância do Anexo da IN SEGES 58/2022.
 */
import type { TrailDefinition } from "../../types";

export const servicoComumContinuadoEtp: TrailDefinition = {
  slug: "servico-comum-continuado-etp",
  natureza: "SERVICO_CONTINUADO",
  documentType: "ETP",
  version: 1,
  title: "ETP — Serviço Comum Continuado",
  description:
    "Trilha de Estudo Técnico Preliminar para contratação de serviços comuns de natureza continuada, com fundamento no art. 18 §1º da Lei 14.133/2021 e no Anexo da IN SEGES 58/2022.",
  sections: [
    {
      key: "descricao-necessidade",
      title: "Descrição da necessidade da contratação",
      shortLabel: "Necessidade",
      ordem: 1,
      required: true,
      discretionary: false,
      legalAnchors: [
        {
          kind: "lei",
          label: "Lei 14.133/2021, art. 18, §1º, I",
          articleNumber: "18",
        },
        { kind: "in", label: "IN SEGES 58/2022, Anexo, item 2.1" },
      ],
      didactic: {
        conceito:
          "Descrição clara e objetiva da necessidade a ser atendida pela contratação, evidenciando o problema ou oportunidade de forma independente da solução.",
        fundamento:
          "A descrição da necessidade é ponto de partida do ETP e deve ser redigida em termos de problema, não de solução. Alinha-se ao princípio do planejamento (art. 5º) e orienta toda a cadeia decisória subsequente.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["etp", "planejamento", "art-18"],
        minSimilarity: 0.55,
        limit: 12,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Redija a descrição da necessidade da contratação a seguir, em prosa técnico-jurídica, sem marcadores, em 2 a 4 parágrafos, explicitando o problema, o público afetado e a motivação institucional. Não descreva a solução, apenas a necessidade. Contexto do órgão: {{orgao}}. Descrição livre informada pelo aluno: {{descricaoLivre}}. Fundamente com Lei 14.133/2021, art. 18, §1º, I.",
      },
      checkpoint: {
        question:
          "Por que a descrição da necessidade deve ser redigida em termos de problema e não de solução?",
        rubricMd:
          "Espera-se que o aluno vincule a resposta ao princípio do planejamento (art. 5º) e à independência entre a necessidade e a solução escolhida, evitando direcionamento.",
      },
      sufficiencyHeuristicRefs: ["minWords:120", "mentionsLaw:14133"],
    },

    {
      key: "requisitos-contratacao",
      title: "Requisitos da contratação",
      shortLabel: "Requisitos",
      ordem: 2,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, II", articleNumber: "18" },
        { kind: "in", label: "IN SEGES 58/2022, Anexo, item 2.2" },
      ],
      didactic: {
        conceito:
          "Conjunto de requisitos funcionais, técnicos, de qualidade, de sustentabilidade e de execução aplicáveis ao objeto.",
        fundamento:
          "Os requisitos devem ser objetivos, verificáveis e proporcionais, sem gerar restrição indevida à competitividade (art. 11, I e III).",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["requisitos", "etp", "sustentabilidade"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Liste, em prosa corrida sem marcadores, os requisitos da contratação de {{descricaoLivre}}, abrangendo (i) requisitos funcionais, (ii) requisitos técnicos mínimos, (iii) requisitos de qualidade e (iv) requisitos de sustentabilidade quando cabíveis. Evite exigências restritivas não justificadas. Cite art. 18, §1º, II da Lei 14.133/2021.",
      },
      sufficiencyHeuristicRefs: ["minWords:150"],
    },

    {
      key: "levantamento-mercado",
      title: "Levantamento de mercado e análise de contratações similares",
      shortLabel: "Mercado",
      ordem: 3,
      required: true,
      discretionary: true,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, III e IV", articleNumber: "18" },
        { kind: "in", label: "IN SEGES 65/2021" },
      ],
      didactic: {
        conceito:
          "Pesquisa sobre as soluções disponíveis no mercado e sobre contratações similares realizadas por outros órgãos, com o objetivo de subsidiar a escolha da solução e a estimativa de preços.",
        fundamento:
          "Dever imposto pelo art. 18, §1º, III e IV. A IN SEGES 65/2021 detalha critérios aceitáveis para a pesquisa de preços (painel de preços, contratos públicos análogos, cotações diretas etc.).",
      },
      ragFilter: {
        sourceTypes: ["document", "legislative-act", "tribunal-decision"],
        categories: ["pesquisa-precos", "mercado", "IN-65-2021"],
        minSimilarity: 0.5,
        limit: 15,
        includeTribunalDecisions: true,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Apresente o levantamento de mercado para {{descricaoLivre}}, em prosa técnico-jurídica, descrevendo: (i) métodos de pesquisa adotados conforme IN SEGES 65/2021, (ii) contratações similares em outros órgãos e (iii) limitações encontradas. Cite expressamente art. 18, §1º, III e IV da Lei 14.133/2021.",
      },
      checkpoint: {
        question:
          "Em que hipótese é admissível dispensar a análise de contratações similares?",
        rubricMd:
          "Quando o objeto for inédito ou não houver contratações análogas disponíveis, mediante justificativa fundamentada no ETP.",
      },
      sufficiencyHeuristicRefs: ["minWords:180", "mentionsIn:65-2021"],
    },

    {
      key: "descricao-solucao",
      title: "Descrição da solução como um todo",
      shortLabel: "Solução",
      ordem: 4,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, V", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Definição integrada da solução escolhida, considerando ciclo de vida, operação, manutenção e descarte (quando aplicável).",
        fundamento:
          "A solução deve ser descrita em perspectiva sistêmica, não como mera enumeração de insumos (art. 18, §1º, V).",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["solucao", "ciclo-de-vida"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Descreva a solução escolhida para atender à necessidade de {{descricaoLivre}}, em prosa, considerando ciclo de vida, operação e manutenção. Cite art. 18, §1º, V da Lei 14.133/2021.",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "estimativa-quantidades",
      title: "Estimativa das quantidades",
      shortLabel: "Quantidades",
      ordem: 5,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, VI", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Quantificação dos bens ou serviços a contratar, com memória de cálculo e série histórica quando disponível.",
        fundamento:
          "Art. 18, §1º, VI. Exige-se memória de cálculo e justificativa metodológica; em serviços continuados, a estimativa deve expressar a demanda recorrente do órgão.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["quantidades", "memoria-calculo"],
        minSimilarity: 0.55,
        limit: 10,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Apresente a estimativa das quantidades para {{descricaoLivre}}, em prosa, incluindo memória de cálculo e série histórica quando cabível. Cite art. 18, §1º, VI.",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "estimativa-valor",
      title: "Estimativa do valor da contratação",
      shortLabel: "Valor",
      ordem: 6,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, VI e art. 23", articleNumber: "23" },
        { kind: "in", label: "IN SEGES 65/2021" },
      ],
      didactic: {
        conceito:
          "Valor estimado global e unitário da contratação, formado conforme o art. 23 e a IN SEGES 65/2021.",
        fundamento:
          "A estimativa do valor condiciona a modalidade (arts. 28 a 33) e o critério de julgamento (art. 33). A IN SEGES 65/2021 define parâmetros de pesquisa de preços.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "legislative-act"],
        categories: ["valor", "pesquisa-precos", "IN-65-2021"],
        minSimilarity: 0.55,
        limit: 12,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        requiresMatrix: true,
        userTemplate:
          "Apresente a estimativa do valor da contratação para {{descricaoLivre}}, em prosa, indicando método de formação do preço conforme IN SEGES 65/2021 e as fontes utilizadas. Cite art. 23 da Lei 14.133/2021.",
      },
      checkpoint: {
        question:
          "Por que a estimativa de valor condiciona a modalidade e o critério de julgamento?",
        rubricMd:
          "Porque os arts. 28 a 33 articulam modalidades e critérios em função do objeto e do valor, sendo o pregão vedado para serviços especiais.",
      },
      sufficiencyHeuristicRefs: ["minWords:120", "mentionsArt:23"],
    },

    {
      key: "justificativa-parcelamento",
      title: "Justificativa para o parcelamento ou não da contratação",
      shortLabel: "Parcelamento",
      ordem: 7,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 40, V, b e art. 47", articleNumber: "47" },
      ],
      didactic: {
        conceito:
          "Análise sobre dividir ou não o objeto em itens, grupos ou lotes, equilibrando economia de escala e ampliação da competitividade.",
        fundamento:
          "Regra geral de parcelamento (art. 47, II). A não divisão exige justificativa técnica, econômica ou operacional.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "tribunal-decision"],
        categories: ["parcelamento", "competitividade"],
        minSimilarity: 0.55,
        limit: 10,
        includeTribunalDecisions: true,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Justifique o parcelamento ou a não divisão do objeto relativo a {{descricaoLivre}}, em prosa técnico-jurídica, confrontando economia de escala, competitividade e viabilidade operacional. Cite art. 47 da Lei 14.133/2021.",
      },
      sufficiencyHeuristicRefs: ["minWords:100"],
    },

    {
      key: "contratacoes-correlatas",
      title: "Contratações correlatas e/ou interdependentes",
      shortLabel: "Correlatas",
      ordem: 8,
      required: false,
      discretionary: true,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, VIII", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Identificação de contratações correlatas ou interdependentes necessárias para que a solução escolhida funcione adequadamente.",
        fundamento:
          "Art. 18, §1º, VIII. Aplicável quando o objeto depende de outras aquisições em curso.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        minSimilarity: 0.5,
        limit: 8,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Descreva as contratações correlatas ou interdependentes aplicáveis ao objeto {{descricaoLivre}}. Caso inexistam, justifique a ausência.",
      },
      sufficiencyHeuristicRefs: ["minWords:60"],
    },

    {
      key: "alinhamento-estrategico",
      title: "Demonstração do alinhamento às estratégias do órgão",
      shortLabel: "Alinhamento",
      ordem: 9,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, IX", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Demonstração da aderência da contratação ao plano estratégico, ao plano anual de contratações e às políticas transversais do órgão.",
        fundamento: "Art. 18, §1º, IX.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["alinhamento", "pac"],
        minSimilarity: 0.5,
        limit: 8,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Demonstre o alinhamento da contratação {{descricaoLivre}} ao planejamento estratégico e ao plano anual de contratações do órgão {{orgao}}.",
      },
      sufficiencyHeuristicRefs: ["minWords:80"],
    },

    {
      key: "resultados-pretendidos",
      title: "Resultados pretendidos",
      shortLabel: "Resultados",
      ordem: 10,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, X", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Benefícios esperados em termos de economicidade, eficiência, eficácia e efetividade, expressos preferencialmente em indicadores.",
        fundamento: "Art. 18, §1º, X.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        categories: ["resultados", "indicadores"],
        minSimilarity: 0.5,
        limit: 8,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Descreva os resultados pretendidos com a contratação {{descricaoLivre}}, incluindo indicadores quando possível. Cite art. 18, §1º, X.",
      },
      sufficiencyHeuristicRefs: ["minWords:80"],
    },

    {
      key: "providencias-previas",
      title: "Providências a serem adotadas pela Administração",
      shortLabel: "Providências",
      ordem: 11,
      required: false,
      discretionary: true,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, XI", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Providências prévias ou concomitantes (capacitação, adaptações de infraestrutura, ajustes normativos internos) necessárias à execução.",
        fundamento: "Art. 18, §1º, XI.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        minSimilarity: 0.5,
        limit: 8,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Liste, em prosa, as providências prévias que a Administração deve adotar para viabilizar a contratação {{descricaoLivre}}.",
      },
      sufficiencyHeuristicRefs: ["minWords:60"],
    },

    {
      key: "riscos-contratacao",
      title: "Riscos da contratação e seu tratamento",
      shortLabel: "Riscos",
      ordem: 12,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, XII e art. 22, §1º", articleNumber: "22" },
      ],
      didactic: {
        conceito:
          "Mapeamento dos riscos relevantes (técnicos, jurídicos, econômicos, operacionais) e das medidas de mitigação, em consonância com a matriz de riscos do contrato (art. 22, §1º).",
        fundamento: "Art. 18, §1º, XII e art. 22, §1º.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article", "tribunal-decision"],
        categories: ["riscos", "matriz-riscos"],
        minSimilarity: 0.55,
        limit: 10,
        includeTribunalDecisions: true,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Apresente os principais riscos da contratação {{descricaoLivre}}, com probabilidade, impacto e medidas de mitigação, articulando-os à matriz de riscos do contrato (art. 22, §1º).",
      },
      sufficiencyHeuristicRefs: ["minWords:120"],
    },

    {
      key: "posicionamento-conclusivo",
      title: "Posicionamento conclusivo sobre a viabilidade",
      shortLabel: "Conclusão",
      ordem: 13,
      required: true,
      discretionary: false,
      legalAnchors: [
        { kind: "lei", label: "Lei 14.133/2021, art. 18, §1º, XIII", articleNumber: "18" },
      ],
      didactic: {
        conceito:
          "Manifestação final do ETP sobre a viabilidade e razoabilidade da contratação, com recomendação fundamentada.",
        fundamento: "Art. 18, §1º, XIII.",
      },
      ragFilter: {
        sourceTypes: ["document", "lei-article"],
        minSimilarity: 0.5,
        limit: 6,
      },
      promptSpec: {
        systemRef: "etp.secao.prose",
        aiTask: "enhancement",
        userTemplate:
          "Elabore o posicionamento conclusivo do ETP sobre a viabilidade da contratação {{descricaoLivre}}, em prosa técnico-jurídica, indicando recomendação fundamentada.",
      },
      sufficiencyHeuristicRefs: ["minWords:80"],
    },
  ],
};

export default servicoComumContinuadoEtp;
