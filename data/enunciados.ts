/**
 * Enunciados interpretativos sobre a Lei 14.133/2021
 * Fontes: INCP, CJF, IBDA
 */

export interface Enunciado {
  id: string;
  orgao: 'INCP' | 'CJF' | 'IBDA';
  numero: number;
  texto: string;
  artigosVinculados: string[];
  jornada: string;
  data: string | null;
  url: string;
  tema: string;
}

export interface EnunciadoMetadata {
  fonte: string;
  totalEnunciados: number;
  urlOficial: string;
}

// Mapeamento de artigos para enunciados (para busca rápida)
export const ARTIGOS_ENUNCIADOS: Record<string, string[]> = {};

// Lista completa de enunciados
export const ENUNCIADOS: Enunciado[] = [
  // ==================== INCP ====================
  {
    id: "INCP-1",
    orgao: "INCP",
    numero: 1,
    texto: "Para fins de interpretação do artigo 20 da Lei 14.133/2021, o conceito de itens de consumo de luxo abrange, inclusive, os itens envolvidos em obras, serviços e locações.",
    artigosVinculados: ["20"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-2",
    orgao: "INCP",
    numero: 2,
    texto: "São considerados de luxo os itens cujas especificações sejam manifestamente superiores à necessidade da Administração descrita no processo de contratação.",
    artigosVinculados: ["20"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-3",
    orgao: "INCP",
    numero: 3,
    texto: "A estimativa do valor da contratação constante do Estudo Técnico Preliminar, que está relacionada à escolha da solução do que a definição de um preço de referência, não precisa seguir estritamente todas as regras definidas pelo artigo 23 da Lei nº 14.133/2021, permitindo a opção por aferições mais simples, quando cabível.",
    artigosVinculados: ["23"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-4",
    orgao: "INCP",
    numero: 4,
    texto: "Nos termos do inciso III, art. 41 da Lei nº 14.133/2021, para que a Administração Pública proceda à vedação de modelo e marca, deve-se observar: (i) a incidência da vedação recai sobre o objeto, não sobre a empresa contratada; (ii) a vedação deve se referir a objetos já adquiridos e utilizados pela Administração; (iii) a vedação deve se pautar em critérios objetivamente identificáveis e aferíveis; (iv) a vedação deve decorrer de prévio processo administrativo que garanta o contraditório e a ampla defesa; (v) a vedação deve ser consequência lógica das conclusões obtidas no processo administrativo; (vi) os impactos da vedação nas licitações em curso e nos contratos já em execução; (vii) os recursos cabíveis contra a decisão de vedação; (viii) o tempo de duração da vedação; e (ix) as hipóteses de reabilitação da marca perante a Administração.",
    artigosVinculados: ["41"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-5",
    orgao: "INCP",
    numero: 5,
    texto: "Nos termos do art. 181, os entes federativos deverão avaliar a conveniência e oportunidade de instituir centrais de compras, com o objetivo de realizar compras em grande escala, para atender a diversos órgãos e entidades sob sua competência e atingir as finalidades da Lei 14.133/2021.",
    artigosVinculados: ["181"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-6",
    orgao: "INCP",
    numero: 6,
    texto: "É admitida a participação em licitação ou a contratação direta de empresa em recuperação judicial ou extrajudicial, diante da ausência de vedação expressa na Lei 14.133/2021.",
    artigosVinculados: [],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-7",
    orgao: "INCP",
    numero: 7,
    texto: "A modalidade leilão pode ser utilizada em contratos que tenham como critério de julgamento o maior lance, ainda que não sejam hipóteses de alienação de bens imóveis ou de bens móveis inservíveis ou legalmente apreendidos, como a licitação para concessão de uso de bens públicos.",
    artigosVinculados: ["31"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-8",
    orgao: "INCP",
    numero: 8,
    texto: "Na modalidade diálogo competitivo, os critérios de pré-seleção, previstos no inciso II do §1º do artigo 32 da Lei 14.133/2021, não precisam se limitar às exigências previstas nos artigos 62 a 70 da mesma Lei.",
    artigosVinculados: ["32", "62", "63", "64", "65", "66", "67", "68", "69", "70"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-9",
    orgao: "INCP",
    numero: 9,
    texto: "A dispensa, parcial ou total, da documentação de habilitação, prevista no inciso III do art. 70, não exige justificativa, devendo ser motivada nas demais hipóteses.",
    artigosVinculados: ["70"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-10",
    orgao: "INCP",
    numero: 10,
    texto: "Em que pese não haver previsão legal, o sorteio poderá ser utilizado como critério de desempate, quando todos os critérios previstos nos incisos do artigo 60 e §1º da Lei 14.133/21 quando forem utilizados sem sucesso.",
    artigosVinculados: ["60"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-11",
    orgao: "INCP",
    numero: 11,
    texto: "O art. 59, § 4º, da Lei nº 14.133/2021, contempla presunção relativa de inexequibilidade às propostas de obras e serviços de engenharia, situação em que a Administração deverá realizar as diligências previstas no inciso IV e no § 2º, ambos daquele artigo.",
    artigosVinculados: ["59"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-12",
    orgao: "INCP",
    numero: 12,
    texto: "A hipótese de inexigibilidade de licitação do art. 74, inc. III, da Lei 14.133/2021 não exige pesquisa prévia de preços, devendo a Administração identificar o profissional ou empresa a ser contratada nos termos do §3º daquele artigo, justificando o preço conforme o art. 23, §4º da mesma Lei.",
    artigosVinculados: ["74", "23"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Contratação Direta"
  },
  {
    id: "INCP-13",
    orgao: "INCP",
    numero: 13,
    texto: "O termo de contrato poderá ser substituído por outro instrumento hábil na hipótese de contratação cujo valor não ultrapasse os limites estabelecidos para a dispensa de licitação, inclusive nas inexigibilidades.",
    artigosVinculados: ["95"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-14",
    orgao: "INCP",
    numero: 14,
    texto: "O termo inicial do reajustamento em sentido estrito é a data do orçamento, que deverá ser indicada expressamente no ato convocatório.",
    artigosVinculados: ["92"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-15",
    orgao: "INCP",
    numero: 15,
    texto: "A hipótese de vigência de contrato por escopo ser automaticamente prorrogada, caso o objeto não tenha sido concluído no período pactuado, não implica necessariamente a ausência dessa formalização, mesmo que a posteriori, o que pode ser feito por termo aditivo ou por apostilamento.",
    artigosVinculados: ["111"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-16",
    orgao: "INCP",
    numero: 16,
    texto: "Constitui direito do contratado e da sociedade que a análise do impacto invalidatório, prevista pelo artigo 147 da Lei nº 14.133/2021, seja realizada, sendo ainda, condição para que se entenda legítimo o ato de suspensão ou invalidação.",
    artigosVinculados: ["147"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-17",
    orgao: "INCP",
    numero: 17,
    texto: "A prorrogação da Ata de Registro de Preços admite a renovação das quantidades registradas, independentemente de previsão no edital ou na ata.",
    artigosVinculados: ["84"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Sistema de Registro de Preço"
  },
  {
    id: "INCP-18",
    orgao: "INCP",
    numero: 18,
    texto: "Excepcionalmente, nos casos de esgotamento da quantidade registrada, será admitida a antecipação da prorrogação, pelo prazo máximo de doze meses, com a renovação das quantidades.",
    artigosVinculados: ["84"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Sistema de Registro de Preço"
  },
  {
    id: "INCP-19",
    orgao: "INCP",
    numero: 19,
    texto: "A participação do agente de contratação ou pregoeiro, do fiscal e do gestor do contrato na condução do processo administrativo sancionador fere os princípios da impessoalidade e da segregação de funções nos casos em que a infração estiver relacionada à etapa do processo em que tenha atuado.",
    artigosVinculados: ["7", "155", "156", "157", "158"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Processo Administrativo Sancionador"
  },
  {
    id: "INCP-20",
    orgao: "INCP",
    numero: 20,
    texto: "As estatais devem observar a obrigação de manter regulamento atualizado, nos termos do artigo 40 da Lei n. 13.303/2016, podendo, excepcionalmente, utilizar regras compatíveis da Lei n. 14.133/2021 para integração analógica.",
    artigosVinculados: [],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Estatais"
  },
  {
    id: "INCP-21",
    orgao: "INCP",
    numero: 21,
    texto: "Enquanto o art. 66 da Lei nº 13.303/16 não for regulamentado pelo Decreto do Poder Executivo do ente federativo respectivo, as empresas públicas e sociedades de economia mista podem aplicar subsidiariamente as disposições do Decreto nº 11.462/2023, desde que previsto em seu regulamento interno de licitações e contratos.",
    artigosVinculados: [],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Estatais"
  },
  {
    id: "INCP-22",
    orgao: "INCP",
    numero: 22,
    texto: "O grau de risco de integridade, como condição excludente da participação na licitação, é incompatível com as exigências de habilitação, não estando em conformidade com o artigo 37, XXI da CF/88, podendo, contudo, representar situação para reforço de garantia nos limites da Lei, ampliação de fiscalização, estruturação de programa de integridade, dentre outras exigências permitidas na fase contratual.",
    artigosVinculados: ["25"],
    jornada: "1ª Reunião Técnica INCP",
    data: null,
    url: "https://infranca.com.br/",
    tema: "Riscos e Integridade"
  },
  {
    id: "INCP-23",
    orgao: "INCP",
    numero: 23,
    texto: "O Documento de Formalização da Demanda (DFD) ou documento equivalente deve iniciar todos os processos de contratação e não apenas os processos administrativos que instruem a contratação direta.",
    artigosVinculados: ["72"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-24",
    orgao: "INCP",
    numero: 24,
    texto: "A atuação conjunta entre os agentes responsáveis pelo planejamento e pela gestão e fiscalização do contrato, durante a elaboração do Estudo Técnico Preliminar (ETP) e do Termo de Referência (TR), é essencial para prevenir falhas na execução contratual, sendo recomendada a realização de reuniões periódicas para alinhamento.",
    artigosVinculados: ["18", "6"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-25",
    orgao: "INCP",
    numero: 25,
    texto: "Nos contratos de fornecimento contínuo, o quantitativo contratado para cada exercício financeiro deve ser compatível com o plano de contratações anual.",
    artigosVinculados: ["12", "106"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-26",
    orgao: "INCP",
    numero: 26,
    texto: "As atividades típicas de gestão direcionadas ao controle interno na Lei 14.133/2021 não devem ser atribuídas à auditoria interna, compreendida como a estrutura organizacional de terceira linha, responsável pelas atividades de consultoria e avaliação independente e objetiva da gestão.",
    artigosVinculados: ["169"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-27",
    orgao: "INCP",
    numero: 27,
    texto: "A não apresentação de documentos de habilitação, após a realização de diligências, quando for o caso, equipara-se à não apresentação dos documentos para contratação, para os fins da execução integral da garantia na forma do § 3º do art. 58 da Lei 14.133/2021.",
    artigosVinculados: ["58"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Planejamento e Governança"
  },
  {
    id: "INCP-28",
    orgao: "INCP",
    numero: 28,
    texto: "Para fins de habilitação econômico-financeira em licitações, os índices de Capital Circulante Líquido (CCL) e Patrimônio Líquido (PL) deverão ser calculados com base nas demonstrações contábeis do último exercício social disponível, a fim de assegurar avaliação mais precisa e atual da situação financeira das empresas licitantes.",
    artigosVinculados: ["69"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-29",
    orgao: "INCP",
    numero: 29,
    texto: "É admissível que a Administração Pública exija, como requisito de habilitação econômico-financeira, a apresentação do balanço patrimonial, demonstração do resultado do exercício e outras demonstrações contábeis, referentes aos dois últimos exercícios sociais ou, alternativamente, apenas do mais recente, conforme especificado no instrumento convocatório.",
    artigosVinculados: ["69"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Licitação"
  },
  {
    id: "INCP-30",
    orgao: "INCP",
    numero: 30,
    texto: "No que se refere à dispensa de licitação em razão do valor, prevista nos incisos I e II do artigo 75 da Lei 14.133/2021, para contratos de fornecimento ou serviço continuado com vigência plurianual, deve ser considerado como valor da contratação o montante equivalente ao período de 1 (um) ano de vigência do contrato, conforme § 1º do artigo 75 da Lei 14.133/2021.",
    artigosVinculados: ["75"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Contratação Direta"
  },
  {
    id: "INCP-31",
    orgao: "INCP",
    numero: 31,
    texto: "A garantia adicional à qual se refere o §5º do art. 59 da Lei nº 14.133, de 2021, tem natureza de garantia contratual e pode ser prestada nas mesmas modalidades e prazos previstos no art. 96 da Lei 14.133/2021.",
    artigosVinculados: ["59", "96"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-32",
    orgao: "INCP",
    numero: 32,
    texto: "No recebimento provisório de serviços contínuos em regime de dedicação exclusiva de mão de obra, em razão da responsabilidade subsidiária e solidária prevista no art. 121 da Lei 14.133/2021, deve ser emitido termo detalhado atestando o cumprimento das obrigações e exigências de caráter técnico e administrativo.",
    artigosVinculados: ["121", "140"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-33",
    orgao: "INCP",
    numero: 33,
    texto: "Para os fins do art. 143 da Lei 14.133/2021, divergências entre o fiscal e o contratado a respeito da execução do objeto devem ser encaminhadas ao gestor do contrato para decisão fundamentada, oportunidade em que deve ser avaliado se a entrega parcial atende ao interesse público, sem prejuízo da utilização de métodos alternativos de resolução de conflitos, caso previstos.",
    artigosVinculados: ["143"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-34",
    orgao: "INCP",
    numero: 34,
    texto: "Não configura parcela incontroversa, para efeito do art. 143 da Lei nº 14.133/2021, a divergência acerca da qualidade, quando o objeto entregue for inadequado para o atendimento do interesse público.",
    artigosVinculados: ["143"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-35",
    orgao: "INCP",
    numero: 35,
    texto: "Nas hipóteses de extinção contratual do art. 138 da Lei 14.133/2021, deverão ser avaliadas, em cada caso concreto, as consequências práticas da decisão, conforme as necessidades do interesse público envolvido, sendo boa prática observar os aspectos previstos no art. 147 da mesma lei.",
    artigosVinculados: ["138", "147"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Contratos"
  },
  {
    id: "INCP-36",
    orgao: "INCP",
    numero: 36,
    texto: "É admissível o credenciamento com prazo de vigência indeterminado, sem prejuízo da possibilidade de ulterior revogação do procedimento, mediante comprovação da conveniência administrativa.",
    artigosVinculados: ["79"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Credenciamento"
  },
  {
    id: "INCP-37",
    orgao: "INCP",
    numero: 37,
    texto: "Não viola o princípio da isonomia, tampouco desnatura a figura do credenciamento, a utilização, para a hipótese prevista no inciso I do art. 79, de critérios técnicos objetivos, mediante pontuação, para definir a ordem de distribuição da demanda aos credenciados, quando não for conveniente para o interesse público a contratação imediata de todos.",
    artigosVinculados: ["79"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Credenciamento"
  },
  {
    id: "INCP-38",
    orgao: "INCP",
    numero: 38,
    texto: "A renovação dos quantitativos da ata de registro de preços exige anuência do fornecedor.",
    artigosVinculados: ["84"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Sistema de Registro de Preço"
  },
  {
    id: "INCP-39",
    orgao: "INCP",
    numero: 39,
    texto: "Em caso de atraso no cumprimento do contrato, é vedada a aplicação automática da multa de mora, sem a avaliação criteriosa da culpabilidade do contratado, respeitada a garantia da ampla defesa e do contraditório.",
    artigosVinculados: ["156", "157"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Processo Administrativo Sancionador"
  },
  {
    id: "INCP-40",
    orgao: "INCP",
    numero: 40,
    texto: "Na ausência de disposição específica, o prazo para a apresentação de defesa prévia em processo administrativo sancionador, em caso de aplicação da sanção de advertência, é aquele previsto na lei geral de processo administrativo do respectivo ente federativo.",
    artigosVinculados: ["156", "157", "158"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Processo Administrativo Sancionador"
  },
  {
    id: "INCP-41",
    orgao: "INCP",
    numero: 41,
    texto: "O artigo 10 da Lei 14.133/2021 não invade a seara de organização da Advocacia Pública e tem por objetivo definir um direito (de representação) em favor do agente público que, atuando em nome da Administração, praticou um ato administrativo lastreado em orientação emanada pelo órgão jurídico da Administração.",
    artigosVinculados: ["10"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Responsabilização de Agentes Públicos"
  },
  {
    id: "INCP-42",
    orgao: "INCP",
    numero: 42,
    texto: "A responsabilização do gestor e do fiscal do contrato exige comprovação de dolo ou culpa grave no exercício de suas atribuições, não podendo ocorrer a responsabilização automática por falhas exclusivas do contratado ou pela ausência de condições adequadas para a gestão e a fiscalização.",
    artigosVinculados: ["117", "8", "9"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Responsabilização de Agentes Públicos"
  },
  {
    id: "INCP-43",
    orgao: "INCP",
    numero: 43,
    texto: "O contrato de locação de imóveis em que a Administração Pública seja locatária não se sujeita aos limites de vigência previstos na Lei 14.133/2021.",
    artigosVinculados: ["74", "107"],
    jornada: "2ª Reunião Técnica INCP",
    data: "2024-12-14",
    url: "https://infranca.com.br/",
    tema: "Locação de Imóveis pela Administração Pública"
  },

  // ==================== CJF ====================
  // TODO: Adicionar enunciados do CJF quando disponíveis

  // ==================== IBDA ====================
  // TODO: Adicionar enunciados do IBDA quando disponíveis
];

// Metadados por órgão
export const ENUNCIADOS_METADATA: Record<string, EnunciadoMetadata> = {
  INCP: {
    fonte: "Instituto Nacional da Contratação Pública - INCP",
    totalEnunciados: 43,
    urlOficial: "https://infranca.com.br/"
  },
  CJF: {
    fonte: "Conselho da Justiça Federal - CJF",
    totalEnunciados: 0,
    urlOficial: "https://www.cjf.jus.br/"
  },
  IBDA: {
    fonte: "Instituto Brasileiro de Direito Administrativo - IBDA",
    totalEnunciados: 0,
    urlOficial: "https://ibda.com.br/"
  }
};

// Construir mapeamento reverso: artigo -> enunciados
function buildArtigosEnunciados() {
  ENUNCIADOS.forEach(enunciado => {
    enunciado.artigosVinculados.forEach(artigo => {
      // Normalizar artigo (remover parágrafos, incisos para mapeamento principal)
      const artigoNormalizado = artigo.replace(/[-§].*$/, '');
      if (!ARTIGOS_ENUNCIADOS[artigoNormalizado]) {
        ARTIGOS_ENUNCIADOS[artigoNormalizado] = [];
      }
      if (!ARTIGOS_ENUNCIADOS[artigoNormalizado].includes(enunciado.id)) {
        ARTIGOS_ENUNCIADOS[artigoNormalizado].push(enunciado.id);
      }
    });
  });
}

// Executar build do mapeamento
buildArtigosEnunciados();

// Funções auxiliares
export function getEnunciadosPorArtigo(artigo: string): Enunciado[] {
  const ids = ARTIGOS_ENUNCIADOS[artigo] || [];
  return ENUNCIADOS.filter(e => ids.includes(e.id));
}

export function getEnunciadosPorOrgao(orgao: 'INCP' | 'CJF' | 'IBDA'): Enunciado[] {
  return ENUNCIADOS.filter(e => e.orgao === orgao);
}

export function getEnunciadosPorTema(tema: string): Enunciado[] {
  return ENUNCIADOS.filter(e => e.tema.toLowerCase().includes(tema.toLowerCase()));
}

export function buscarEnunciados(query: string): Enunciado[] {
  const queryLower = query.toLowerCase();
  return ENUNCIADOS.filter(e =>
    e.texto.toLowerCase().includes(queryLower) ||
    e.tema.toLowerCase().includes(queryLower)
  );
}
