/**
 * Enunciados interpretativos sobre a Lei 14.133/2021
 * Fontes: CJF, IBDA, INCP
 *
 * Total: 129 enunciados
 * - CJF: 25 (1º Simpósio - 2022)
 * - IBDA: 61 (III Jornada - 2024)
 * - INCP: 43 (1ª e 2ª Reunião Técnica - 2024)
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
  evento?: string;
  data?: string;
}

// Mapeamento de artigos para enunciados (para busca rápida)
export const ARTIGOS_ENUNCIADOS: Record<string, string[]> = {};

// Lista completa de enunciados
export const ENUNCIADOS: Enunciado[] = [
  // ==================== CJF - Conselho da Justiça Federal ====================
  // 1º Simpósio de Licitações e Contratos da Justiça Federal (2022-08-16)
  {
    id: "CJF-1",
    orgao: "CJF",
    numero: 1,
    texto: "Constitui boa prática da Administração, no momento da instrução da prorrogação, emitir alerta à contratada a respeito dos efeitos da formalização do termo aditivo sem a ressalva do direito aos reajustes nos termos da lei e do contrato.",
    artigosVinculados: ["92"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Prorrogação e Reajuste"
  },
  {
    id: "CJF-2",
    orgao: "CJF",
    numero: 2,
    texto: "A atuação da unidade de auditoria interna, para efeitos da aplicação da Lei n. 14.133/2021, dar-se-á na forma de terceira linha de defesa, consoante inciso III do art. 169 e mediante técnicas de auditoria, em atendimento às Resoluções CNJ n. 308 e 309/2020, CJF n. 676 e 677/2020 e aos normativos técnicos de auditoria. Os tribunais podem instituir estruturas administrativas destinadas a absorver as atribuições necessárias ao cumprimento do inciso II do art. 169 (segunda linha de defesa), com vistas a manter a adequada segregação de funções entre os agentes responsáveis pelos controles internos.",
    artigosVinculados: ["169", "169-II", "169-III"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Governança - Controle Interno"
  },
  {
    id: "CJF-3",
    orgao: "CJF",
    numero: 3,
    texto: "A efetivação da prorrogação contratual prevista no art. 107 da Lei n. 14.133/2021 fica condicionada a uma avaliação qualitativa realizada pelo fiscal/gestor do contrato em relação aos serviços prestados pela contratada, devendo utilizar-se de parâmetros objetivos de avaliação.",
    artigosVinculados: ["107"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Prorrogação"
  },
  {
    id: "CJF-4",
    orgao: "CJF",
    numero: 4,
    texto: "Os acréscimos e as supressões de quantitativos decorrentes de alteração contratual devem ser considerados isoladamente, ou seja, o conjunto de acréscimos e o conjunto de supressões devem ser sempre calculados sobre o valor inicial atualizado do contrato, aplicando-se, a cada um desses conjuntos, sem nenhum tipo de compensação entre eles, os limites de alteração estabelecidos no art. 125 da Lei n. 14.133/2021.",
    artigosVinculados: ["125"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Alteração Contratual"
  },
  {
    id: "CJF-5",
    orgao: "CJF",
    numero: 5,
    texto: "Em atenção aos princípios da eficiência e do formalismo moderado e em face do caráter instrumental dos procedimentos licitatórios, ainda que não apresentados na oportunidade prevista em regulamento e/ou no edital, será admitida a juntada posterior de documentos de habilitação referentes às declarações emitidas unilateralmente pelo licitante.",
    artigosVinculados: ["5", "64"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Licitação - Habilitação"
  },
  {
    id: "CJF-6",
    orgao: "CJF",
    numero: 6,
    texto: "Embora não haja preclusão lógica do direito ao reajuste em sentido estrito, compete à contratada a apresentação do pedido, não cabendo, portanto, ao contratante processar, de ofício, o reajuste.",
    artigosVinculados: ["92"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Reajuste"
  },
  {
    id: "CJF-7",
    orgao: "CJF",
    numero: 7,
    texto: "Pondera-se que os requisitos sustentáveis de aceitação de proposta e habilitação não sejam motivo de desclassificação sumária de licitantes que não detêm ingerência sobre tal regularidade, sendo razoável, na condução do certame pelo agente/comissão de contratação, que seja oportunizada a troca de marca/produto, desde que em igual ou superior qualidade ao ofertado inicialmente, porém, com o atendimento de todas as especificações e requisitos dispostos em edital.",
    artigosVinculados: ["11"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Licitação - Sustentabilidade"
  },
  {
    id: "CJF-8",
    orgao: "CJF",
    numero: 8,
    texto: "O agente de contratação de que trata o art. 8º da Lei n. 14.133/2021 somente poderá ser responsabilizado, em tal qualidade, em decorrência dos atos decisórios praticados em razão da condução da fase externa das modalidades de licitação, observado o disposto no art. 28 do Decreto-lei n. 4.657/1942 (Lei de introdução às normas do Direito Brasileiro) e a eventual fundamentação das decisões com base em pareceres e manifestações técnicas do órgão de assessoramento jurídico e/ou das unidades responsáveis pela elaboração dos artefatos de planejamento.",
    artigosVinculados: ["8"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Agentes de Contratação - Responsabilização"
  },
  {
    id: "CJF-9",
    orgao: "CJF",
    numero: 9,
    texto: "Em sede de diligência, o agente de contratação poderá realizar, de ofício, consultas junto aos sítios eletrônicos e às bases de dados oficiais para verificação do atendimento de condições de habilitação do licitante, inclusive no tocante a documentos eventualmente não apresentados.",
    artigosVinculados: ["12-VI", "67", "68", "87"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Licitação - Diligência e Habilitação"
  },
  {
    id: "CJF-10",
    orgao: "CJF",
    numero: 10,
    texto: "A juntada posterior de documento referente à comprovação dos requisitos de habilitação de que trata o inciso I do art. 64 da Lei n. 14.133/2021 contempla somente os documentos necessários ao esclarecimento, à retificação e/ou complementação da documentação efetivamente apresentada/enviada pelo licitante provisoriamente vencedor, nos termos do art. 63, inciso II, da NLLCA, em conformidade com o marco temporal preclusivo previsto no regulamento e/ou no edital.",
    artigosVinculados: ["64-I", "63-II"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Licitação - Habilitação"
  },
  {
    id: "CJF-11",
    orgao: "CJF",
    numero: 11,
    texto: "Não é obrigatório parecer jurídico nas contratações de dispensa em razão do valor (art. 75, incisos I e II) e inexigibilidade (art. 74) até o limite de dispensa previsto no art. 75, incisos I e II e § 3º da Lei n. 14.133/2021, ressalvados os casos em que as relações contratuais sejam formalizadas por meio de instrumento de contrato que não seja padronizado no órgão ou nas hipóteses em que o administrador tenha suscitado dúvida a respeito da legalidade da dispensa, consoante disposto no § 5º do art. 53 da nova lei de licitações, devendo a autoridade administrativa do órgão emitir orientação nesse sentido.",
    artigosVinculados: ["75-I", "75-II", "74", "53"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratação Direta - Parecer Jurídico"
  },
  {
    id: "CJF-12",
    orgao: "CJF",
    numero: 12,
    texto: "Consideram-se fornecimentos contínuos, para fins de aplicação do disposto nos arts. 106, 109, parágrafo único do art. 98, parágrafo único do art. 97, inciso I do art. 40 e § 8º do art. 25 da Lei n. 14.133/2021, as compras para a manutenção dos órgãos da Justiça Federal decorrentes de necessidades permanentes ou prolongadas, tais como: a) álcool em gel; b) açúcar; c) água mineral com ou sem gás; d) aquisição, ajustes e consertos de becas, capas e vestimentas afins; e) café em pó; f) fornecimento de gêneros alimentícios; g) fornecimento e instalação de persianas; h) fornecimento, montagem e desmontagem de divisórias e seus componentes; i) licenças de software; j) munições de arma de fogo para treinamentos; k) óleo diesel para geração de energia elétrica; l) fornecimento de material e obra bibliográfica de origem nacional e estrangeira; m) papel higiênico e papel-toalha; n) ressuprimento de material de consumo estocável; o) sabonete líquido; p) suprimentos para impressão em impressora fotográfica; q) suprimentos para impressão de instrumentos de identificação; r) uniformes.",
    artigosVinculados: ["106", "109", "98", "97", "40-I", "25"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Fornecimento Contínuo"
  },
  {
    id: "CJF-13",
    orgao: "CJF",
    numero: 13,
    texto: "Consideram-se fornecimentos contínuos, para fins de aplicação do disposto nos arts. 106, 109, parágrafo único do art. 98, parágrafo único do art. 97, inciso I do art. 40 e § 8º do art. 25 da Lei n. 14.133/2021, as compras para a manutenção da Gráfica do Conselho da Justiça Federal decorrentes de necessidades permanentes ou prolongadas, tais como os seguintes itens: a) papéis para aplicação/utilização na indústria gráfica no formato comercial 66x96, em gramaturas variadas; b) espiral metálico Wire-o; c) tintas da escala CMYC; d) colas granulada e cola branca; e) químicos tipo solvente, solução de fonte, pasta para limpeza profunda dos rolos, álcool isopropílico, água desmineralizada, limpador de chapas, restaurador de blanquetas; f) solução especial para limpeza automática de blanqueta e rolos, pó antimaculador, goma antioxidante, óleo de silicone, lubrificante spray, blanqueta compressível com barra em aço, panos para limpeza de rolos, caneta corretora de chapas gráficas, pano de lavagem automática original para impressora offset Heidelberg.",
    artigosVinculados: ["106", "109", "98", "97", "40-I", "25"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Fornecimento Contínuo (Gráfica)"
  },
  {
    id: "CJF-14",
    orgao: "CJF",
    numero: 14,
    texto: "Consideram-se serviços prestados de forma contínua, para fins de aplicação do disposto nos arts. 106, 109, parágrafo único do art. 98, parágrafo único do art. 97, inciso I do art. 40 e § 8º do art. 25 da Lei n. 14.133/2021, as compras para a manutenção dos órgãos da Justiça Federal decorrentes de necessidades permanentes ou prolongadas, tais como: I – agenciamento de viagens e emissão de passagem aérea e rodoviária; II – apoio operacional, atendente e mensageria; III – assinatura de periódicos, plataformas e bases de dados; IV – atendimento a usuários de TIC; V – atividades de bombeiro civil; VI – aluguel de equipamentos e programas de informática; VII – segurança pessoal privada; VIII – vigilância; IX – coleta e tratamento de resíduos; X – cópia e digitalização; XI – correios e remessas; XII – desinsetização; XIII – energia elétrica; XIV – fotografia; XV – gerenciamento de serviços de TIC; XVI – gerenciamento de combustíveis; XVII – impressão gráfica; XVIII – infovia; XIX – internet; XX – intérprete de Libras; XXI – jardinagem; XXII – lavanderia, limpeza e conservação; XXIII – manutenção predial e de equipamentos; XXIV – plano de saúde; XXV – eventos institucionais; XXVI – produção audiovisual; XXVII – recepção e secretariado; XXVIII – reparo de mobiliário; XXIX – serviços gerais diversos; XXX – design gráfico e web; XXXI – gravação e edição de sessões; XXXII – apoio à administração de dados; XXXIII – desenvolvimento de sistemas; XXXIV – seguro veicular; XXXV – chaveiro; XXXVI – consultas a normas ABNT e tabela Pini; XXXVII – sonorização e degravação; XXXVIII – telefonia; XXXIX – televisão por assinatura; XL – tradução e interpretação; XLI – reciclagem de lâmpadas; XLII – transporte de pessoas e cargas; XLIII – transposição para EAD.",
    artigosVinculados: ["106", "109", "98", "97", "40-I", "25"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Serviços Contínuos"
  },
  {
    id: "CJF-15",
    orgao: "CJF",
    numero: 15,
    texto: "Diante da ocorrência de condutas infracionais tipificadas no art. 155 da Lei n. 14.133/2021, ao agente de contratação compete apenas a comunicação do fato à autoridade superior para fins de avaliação quanto à pertinência de instauração do processo administrativo sancionatório, sendo atentatória aos postulados da segregação de funções e da imparcialidade a atribuição de competências ao agente de contratação para promover a instrução e a deliberação quanto à aplicação e dosimetria de penalidade.",
    artigosVinculados: ["155"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Sanções - Competência do Agente de Contratação"
  },
  {
    id: "CJF-16",
    orgao: "CJF",
    numero: 16,
    texto: "O Documento de Formalização da Demanda – DFD previsto no art. 12, inciso VII, da Lei n. 14.133/2021, que coleta demandas para elaboração do Plano de Contratações Anual, não é o mesmo Documento de Formalização da Demanda, que instrui o processo administrativo de contratação. O primeiro será composto das informações constantes do art. 4º da Resolução CJF n. 701/2021, além da necessidade da unidade demandante. Já o segundo será documento sucinto que abrirá o processo e conterá a necessidade a ser atendida mediante contratação e o respectivo item do PAC.",
    artigosVinculados: ["12-VII"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Planejamento - Documento de Formalização da Demanda"
  },
  {
    id: "CJF-17",
    orgao: "CJF",
    numero: 17,
    texto: "A estimativa do valor da contratação realizada por meio dos Estudos Técnicos Preliminares, de que trata o art. 18, § 1º, inciso VI, será, via de regra, uma análise inicial dos preços praticados no mercado por servir unicamente à análise da autoridade competente quanto à viabilidade econômica da contratação. De forma diferente, há uma estimativa do valor da contratação realizada pelo setor competente do órgão, conforme o art. 6º, inciso XXIII, 'i', que servirá como base à análise da aceitabilidade das propostas na fase externa do processo licitatório e, por isso, utilizará os parâmetros do art. 23 e seus parágrafos, combinados, sempre que possível, em uma 'cesta de preços', priorizando os preços públicos, salvo quando, de acordo com o Manual de Atribuições e Regulamento Interno do órgão, a obrigação recair para o mesmo setor que estiver elaborando os Estudos Técnicos Preliminares.",
    artigosVinculados: ["18", "6-XXIII", "23"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Planejamento - Estimativa de Valor"
  },
  {
    id: "CJF-18",
    orgao: "CJF",
    numero: 18,
    texto: "A análise de riscos que instrui o processo administrativo de contratação, conforme determinam o art. 18, inciso X, da Lei n. 14.133/2021 e, a exemplo, os arts. 11 a 13 da Portaria CJF n. 62/2021, deve lidar com os riscos específicos da solução a ser contratada de forma complementar aos riscos gerais e abstratos já enfrentados no Plano de Tratamento de Riscos do Macroprocesso de Contratação, instrumento de governança nas contratações previsto no art. 5º da Resolução CNJ n. 347/2020.",
    artigosVinculados: ["18-X"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Planejamento - Análise de Riscos"
  },
  {
    id: "CJF-19",
    orgao: "CJF",
    numero: 19,
    texto: "As atribuições e responsabilidades típicas de gestão determinadas à unidade de controle interno por meio da Lei n. 14.133/2021 não podem ser atribuídas à unidade de auditoria interna, por contrariarem o disposto no parágrafo único do art. 2º da Resolução CNJ n. 308/2020. Por sua vez, a implementação de controles internos da gestão de que trata a Lei, sejam eles preventivos ou corretivos, cabe aos gestores envolvidos na instrução do processo administrativo de contratação e às instâncias de governança na ocasião de elaboração do Plano de Tratamento de Riscos do Macroprocesso de Contratação.",
    artigosVinculados: ["169"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Governança - Auditoria e Controle Interno"
  },
  {
    id: "CJF-20",
    orgao: "CJF",
    numero: 20,
    texto: "As contratações públicas submetem-se às práticas contínuas e permanentes de gestão de riscos e de controles internos previstas na Lei n. 14.133/2021, que devem ser implementadas em todo o macroprocesso de contratação, não se limitando à atuação de uma estrutura administrativa de controle interno.",
    artigosVinculados: ["169"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Governança - Gestão de Riscos"
  },
  {
    id: "CJF-21",
    orgao: "CJF",
    numero: 21,
    texto: "As unidades de auditoria interna poderão responder a questionamentos formulados pela Administração, como atividade de consultoria prevista no art. 2º, inciso III, da Resolução CNJ n. 309/2020, observada a capacidade operacional da unidade de auditoria interna, desde que não se refiram a casos concretos, o que configuraria atos de cogestão, prática vedada pelo art. 29, inciso IV, da Resolução CNJ n. 347/2020.",
    artigosVinculados: ["169"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Governança - Consultoria de Auditoria"
  },
  {
    id: "CJF-22",
    orgao: "CJF",
    numero: 22,
    texto: "A proibição de exigência de registro cadastral complementar das licitantes deve ser entendida de forma ampla, a partir dos objetivos da vedação, entre eles, desobrigar o particular de manter ativos diversos cadastros, com a mesma finalidade, incrementando custos de transação.",
    artigosVinculados: ["87"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Licitação - Registro Cadastral"
  },
  {
    id: "CJF-23",
    orgao: "CJF",
    numero: 23,
    texto: "Ferramenta privada de pesquisa de preços mantida por prestador de serviços especializados constitui instrumento idôneo (parâmetro) para a pesquisa de preços na contratação pública.",
    artigosVinculados: ["23"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Planejamento - Pesquisa de Preços"
  },
  {
    id: "CJF-24",
    orgao: "CJF",
    numero: 24,
    texto: "O verbo 'poderá' presente no § 1º do art. 140 da Lei n. 14.133/2021 deverá ser interpretado à luz do art. 147 do mesmo diploma legal.",
    artigosVinculados: ["140", "147"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Recebimento do Objeto"
  },
  {
    id: "CJF-25",
    orgao: "CJF",
    numero: 25,
    texto: "O prazo para resposta ao pedido de repactuação de preços determinado no contrato administrativo (art. 92, inciso X, e § 6º da Lei n. 14.133/2021) começa a fluir somente a partir do momento em que o pedido da contratada se encontre correto e completamente instruído.",
    artigosVinculados: ["92-X", "92"],
    jornada: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16",
    url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    tema: "Contratos - Repactuação"
  },

  // ==================== IBDA - Instituto Brasileiro de Direito Administrativo ====================
  // III Jornada de Direito Administrativo (2024-11-07)
  {
    id: "IBDA-1",
    orgao: "IBDA",
    numero: 1,
    texto: "A incidência da Lei n. 14.133/2021, nos termos dos seus arts. 2º e 3º, permite a aplicação da Convenção das Nações Unidas para a Compra e Venda Internacional de Mercadorias (CISG), aprovada pelo Decreto Legislativo n. 538/2012 e promulgada pelo Decreto n. 8.327/2014, apenas nos pontos em que a Lei n. 14.133/2021 for omissa ou não regular a matéria de modo incompatível com a solução prevista na Convenção.",
    artigosVinculados: ["2", "3"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Âmbito de Aplicação"
  },
  {
    id: "IBDA-2",
    orgao: "IBDA",
    numero: 2,
    texto: "O contrato de securitização formalizado pelo Poder Público não se submete ao regime jurídico dos contratos administrativos disciplinado pela Lei n. 14.133/2021.",
    artigosVinculados: ["3-I"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Âmbito de Aplicação"
  },
  {
    id: "IBDA-3",
    orgao: "IBDA",
    numero: 3,
    texto: "Os critérios de avaliação das soluções que encontram maior aderência ao princípio da economicidade de que trata o art. 5º da Lei n. 14.133/2021, devem considerar o maior retorno socioeconômico à sociedade no âmbito da contratação pretendida, e não apenas o menor desembolso a ser dispensado pela Administração.",
    artigosVinculados: ["5"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Princípios"
  },
  {
    id: "IBDA-4",
    orgao: "IBDA",
    numero: 4,
    texto: "O regime jurídico das sanções previstas na Lei n. 14.133/2021, se mais benéfico, tem o condão de alterar as sanções a serem aplicadas, ou em fase de cumprimento, em contratos firmados com base em legislação pretérita, em decorrência do princípio da retroatividade da lei posterior mais benéfica em matéria sancionatória.",
    artigosVinculados: ["5", "155", "156"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Sanções - Direito Intertemporal"
  },
  {
    id: "IBDA-5",
    orgao: "IBDA",
    numero: 5,
    texto: "O regime de dedicação exclusiva de mão de obra não se limita apenas à realização de serviços contínuos nas dependências do contratante, como definido na alínea 'a' do inciso XVI do art. 6º da Lei n. 14.133/2021, aplicando-se também aos serviços prestados pelos terceirizados ao tomador nas dependências do próprio empregador ou de terceiros.",
    artigosVinculados: ["6-XVI"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Definições"
  },
  {
    id: "IBDA-6",
    orgao: "IBDA",
    numero: 6,
    texto: "O valor da obra de grande vulto, previsto pela Lei n. 14.133/2021, poderá ser reduzido por normativo próprio específico, editado pelos entes subnacionais.",
    artigosVinculados: ["6-XXII", "25"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Definições"
  },
  {
    id: "IBDA-7",
    orgao: "IBDA",
    numero: 7,
    texto: "Os riscos estabelecidos nas relações contratuais devem ser interpretados de maneira sistêmica, levando em consideração a matriz de riscos em conjunto com as demais cláusulas contratuais, conforme disposto no inciso XXVII do art. 6º e no art. 22 da Lei n. 14.133/2021.",
    artigosVinculados: ["6-XXVII", "22"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Matriz de Riscos"
  },
  {
    id: "IBDA-8",
    orgao: "IBDA",
    numero: 8,
    texto: "A exigência de que o agente de contratação e o pregoeiro tenham vínculo permanente com a Administração Pública licitante é norma geral, aplicável a todos os entes da federação.",
    artigosVinculados: ["6-LX"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Agentes de Contratação"
  },
  {
    id: "IBDA-9",
    orgao: "IBDA",
    numero: 9,
    texto: "Viola o princípio da segregação de funções a designação de integrantes das unidades de assessoramento jurídico e de controle interno para exercer, de forma simultânea, a função de agente de contratação/pregoeiro.",
    artigosVinculados: ["7", "169"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Segregação de Funções"
  },
  {
    id: "IBDA-10",
    orgao: "IBDA",
    numero: 10,
    texto: "Não configura desvio de função a designação de agente de contratação para atuar em procedimentos de dispensa e inexigibilidade de licitação, desde que a escolha seja feita respeitando o disposto no art. 7º da Lei n. 14.133/2021.",
    artigosVinculados: ["7", "8"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Agentes de Contratação"
  },
  {
    id: "IBDA-11",
    orgao: "IBDA",
    numero: 11,
    texto: "O termo 'preferencialmente', constante do § 3º do art. 19 da Lei n. 14.133/2021, implica um dever legal para a Administração, de modo que a opção pela não adoção da Modelagem da Informação da Construção (Building Information Modelling – BIM), ou tecnologias e processos integrados similares ou mais avançados que venham a substitui-la, dependerá de justificativa.",
    artigosVinculados: ["19"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "BIM - Modelagem da Informação"
  },
  {
    id: "IBDA-12",
    orgao: "IBDA",
    numero: 12,
    texto: "A exigência de habilitação técnica, profissional e/ou operacional, relacionada à tecnologia Modelagem da Informação da Construção (Building Information Modelling – BIM) independe do critério de julgamento escolhido, podendo ser requerida mesmo quando o critério menor preço for adotado.",
    artigosVinculados: ["33", "67", "19"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "BIM - Habilitação Técnica"
  },
  {
    id: "IBDA-13",
    orgao: "IBDA",
    numero: 13,
    texto: "A exigência de experiência na utilização da tecnologia Modelagem da Informação da Construção (Building Information Modelling – BIM) em licitações de obras e serviços de engenharia não configura exigência de qualificação técnica excessiva, capaz de restringir a competitividade do certame, desde que caracterizada a relevância técnica da utilização desta metodologia para execução do objeto ou seu valor significativo.",
    artigosVinculados: ["67", "19"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "BIM - Qualificação Técnica"
  },
  {
    id: "IBDA-14",
    orgao: "IBDA",
    numero: 14,
    texto: "O critério de julgamento maior lance poderá ser aplicado em licitações na modalidade concorrência, quando demonstrada maior vantajosidade para a Administração.",
    artigosVinculados: ["33-V"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Critério de Julgamento"
  },
  {
    id: "IBDA-15",
    orgao: "IBDA",
    numero: 15,
    texto: "O pregão poderá adotar como critério de julgamento o maior lance, desde que configurada a necessidade da apresentação de propostas sucessivas e crescentes, condicionado à adoção do modo de disputa aberto, isoladamente ou combinado.",
    artigosVinculados: ["33-V"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Pregão - Critério de Julgamento"
  },
  {
    id: "IBDA-16",
    orgao: "IBDA",
    numero: 16,
    texto: "O art. 48 da Lei n. 14.133/2021 não veda à Administração o estabelecimento, no edital da licitação, de valor mínimo de remuneração em favor dos trabalhadores que executarão o serviço terceirizado, desde que essa opção seja justificada no processo licitatório, com base em razões objetivas de interesse público, tais como atender à realidade do mercado, obter serviços mais qualificados ou evitar a excessiva rotatividade da mão de obra.",
    artigosVinculados: ["48"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Terceirização - Remuneração Mínima"
  },
  {
    id: "IBDA-17",
    orgao: "IBDA",
    numero: 17,
    texto: "Após a fase de julgamento, o licitante vencedor deverá reelaborar e apresentar à Administração, por meio eletrônico, as planilhas com os respectivos valores readequados à proposta vencedora, inclusive nos casos de regime de dedicação exclusiva de mão de obra ou predominância de mão de obra.",
    artigosVinculados: ["56"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Proposta - Readequação"
  },
  {
    id: "IBDA-18",
    orgao: "IBDA",
    numero: 18,
    texto: "O § 4º do art. 59 da Lei n. 14.133/2021 contém presunção relativa de inexequibilidade de preços, devendo a Administração dar à licitante a oportunidade de demonstrar a exequibilidade da sua proposta, nos termos do § 2º do mesmo art. 59.",
    artigosVinculados: ["59"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Proposta - Inexequibilidade"
  },
  {
    id: "IBDA-19",
    orgao: "IBDA",
    numero: 19,
    texto: "Nas contratações de obras e serviços de engenharia, ocorrida a situação do art. 59, § 5º, da Lei n. 14.133/2021, a garantia adicional será exigida do licitante vencedor ainda que o instrumento convocatório não tenha exigido a garantia contratual dos arts. 96, caput, e 98, caput, da mesma lei.",
    artigosVinculados: ["59", "96", "98"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Garantia Adicional"
  },
  {
    id: "IBDA-20",
    orgao: "IBDA",
    numero: 20,
    texto: "Esgotados os critérios previstos no art. 60 da Lei n. 14.133/2021 e mantendo-se o empate, é admissível a utilização de critérios objetivos e isonômicos para desempate, tal como o sorteio, desde que previstos em edital e que a procedimentalização esteja objetivamente descrita, garantida a transparência, acompanhamento do procedimento pelos interessados e auditabilidade da ferramenta.",
    artigosVinculados: ["60"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Desempate"
  },
  {
    id: "IBDA-21",
    orgao: "IBDA",
    numero: 21,
    texto: "É indevida a inabilitação de licitante por falta de documento que esteja sob a guarda da Administração promotora da licitação, quando suscitada a questão pelo interessado.",
    artigosVinculados: ["64"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Habilitação"
  },
  {
    id: "IBDA-22",
    orgao: "IBDA",
    numero: 22,
    texto: "É admitida a exigência de comprovação de capacidade técnico-operacional nas licitações para compra de bens, desde que a materialidade, relevância e risco relacionados ao fornecimento demonstrem essa necessidade.",
    artigosVinculados: ["67-II"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Habilitação Técnica"
  },
  {
    id: "IBDA-23",
    orgao: "IBDA",
    numero: 23,
    texto: "A responsabilidade solidária de que trata o art. 73 da Lei n. 14.133/2021 configura-se apenas quando comprovado que ambos atuaram com dolo, fraude ou erro grosseiro.",
    artigosVinculados: ["73"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Responsabilidade Solidária"
  },
  {
    id: "IBDA-24",
    orgao: "IBDA",
    numero: 24,
    texto: "A justificativa de preços baseada em pesquisa diretamente com potenciais prestadores de serviços não inviabiliza, por si só, a contratação por inexigibilidade de licitação.",
    artigosVinculados: ["74", "23"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Inexigibilidade - Pesquisa de Preços"
  },
  {
    id: "IBDA-25",
    orgao: "IBDA",
    numero: 25,
    texto: "A contratação direta, por inexigibilidade, para locação de imóvel cujas características de instalações e de localização tornem necessária sua escolha, pode ser realizada com o locador possuidor, desde que comprovada a justa posse, que deve ser minuciosamente caracterizada e demonstrada nos autos do processo administrativo, para que seja possível a locação.",
    artigosVinculados: ["74-V"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Inexigibilidade - Locação de Imóvel"
  },
  {
    id: "IBDA-26",
    orgao: "IBDA",
    numero: 26,
    texto: "Para fins de aferição dos valores referidos nos incisos I e II do art. 75 da Lei n. 14.133/2021, deve ser considerado somente o somatório do que for despendido no exercício financeiro, independentemente do prazo de duração do contrato administrativo e da previsão de prorrogação contratual.",
    artigosVinculados: ["75-I", "75-II", "75"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Dispensa - Limite de Valor"
  },
  {
    id: "IBDA-27",
    orgao: "IBDA",
    numero: 27,
    texto: "Nos processos de contratação direta fundada nos incisos I e II do art. 75 da Lei n. 14.133/2021, a inobservância do procedimento de divulgação prévia do aviso, previsto no § 3º do art. 75 dessa Lei, deverá ser motivada expressamente nos autos.",
    artigosVinculados: ["75-I", "75-II", "75"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Dispensa - Divulgação"
  },
  {
    id: "IBDA-28",
    orgao: "IBDA",
    numero: 28,
    texto: "No caso de contratação emergencial por dispensa fundada no art. 75, VIII, da Lei n. 14.133/2021, a urgência do caso concreto, oportunamente justificada, autoriza, em caráter excepcional, que os processos relacionados à aquisição de bens e à contratação de serviços sejam formalizados posteriormente.",
    artigosVinculados: ["75-VIII"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Dispensa Emergencial"
  },
  {
    id: "IBDA-29",
    orgao: "IBDA",
    numero: 29,
    texto: "Na contratação por meio de credenciamento, a exigência da comprovação da regularidade fiscal poderá ocorrer apenas no momento da formalização do contrato, não sendo requisito necessário de verificação no procedimento de credenciamento.",
    artigosVinculados: ["79"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Credenciamento"
  },
  {
    id: "IBDA-30",
    orgao: "IBDA",
    numero: 30,
    texto: "É admissível prazo de vigência indeterminado no edital de credenciamento.",
    artigosVinculados: ["79"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Credenciamento - Vigência"
  },
  {
    id: "IBDA-31",
    orgao: "IBDA",
    numero: 31,
    texto: "A certificação de pré-qualificação de bens, mediante justificativa, poderá ser usada no credenciamento para substituir a prova de qualidade, sendo dispensada a exigência de amostra ou prova de conceito.",
    artigosVinculados: ["79", "80"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Credenciamento - Pré-qualificação"
  },
  {
    id: "IBDA-32",
    orgao: "IBDA",
    numero: 32,
    texto: "A abertura do procedimento de manifestação de interesse poderá ser provocada pelas pessoas físicas ou jurídicas que desejam contribuir com a realização de estudos, investigações, levantamentos e projetos, mediante a apresentação de requerimento formal perante a Administração Pública, que deverá examiná-lo com o objetivo de avaliar a conveniência e oportunidade de instaurar tal procedimento.",
    artigosVinculados: ["81"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Procedimento de Manifestação de Interesse"
  },
  {
    id: "IBDA-33",
    orgao: "IBDA",
    numero: 33,
    texto: "Em conformidade com o art. 82 da Lei n. 14.133/2021, a alteração ou a atualização de preços da ata de registro de preços pode ser regulamentada com a utilização de instrumentos próprios de atualização, além do reajuste, da repactuação e da revisão.",
    artigosVinculados: ["82"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Registro de Preços - Atualização"
  },
  {
    id: "IBDA-34",
    orgao: "IBDA",
    numero: 34,
    texto: "São vedadas as adesões, por órgãos da Administração direta, autárquica e fundacional, a atas de registro de preços geradas por empresas estatais, com a aplicação do regime licitatório e contratual da Lei n. 13.303/2016.",
    artigosVinculados: ["86"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Registro de Preços - Adesão"
  },
  {
    id: "IBDA-35",
    orgao: "IBDA",
    numero: 35,
    texto: "É viável a previsão da adesão de órgão ou entidade ao credenciamento, assim como a inserção na qualidade de participante, por analogia à disciplina legal da adesão à ata de registro de preços, prevista no caput e no §2º do art. 86 da Lei n. 14.133/2021.",
    artigosVinculados: ["86"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Credenciamento - Adesão"
  },
  {
    id: "IBDA-36",
    orgao: "IBDA",
    numero: 36,
    texto: "A substituição do instrumento de contrato, estabelecida no inciso I do art. 95 da Lei n. 14.133/2021, é também possível nos demais casos de dispensa de licitação, de inexigibilidade e de contratação mediante licitação, contanto que o valor da contratação respeite os limites estabelecidos nos incisos I e II do art. 75 dessa lei.",
    artigosVinculados: ["95-I", "75-I", "75-II"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Instrumento de Contrato"
  },
  {
    id: "IBDA-37",
    orgao: "IBDA",
    numero: 37,
    texto: "A norma do inciso II do art. 95 da Lei n. 14.133/2021 aplica-se também aos contratos de prestação de serviços, desde que possam ser executados no prazo de até 30 (trinta) dias, a contar da ordem de serviço, e deles não resultem obrigações futuras, inclusive quanto à assistência técnica, quando cabível.",
    artigosVinculados: ["95-II"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Instrumento de Contrato - Serviços"
  },
  {
    id: "IBDA-38",
    orgao: "IBDA",
    numero: 38,
    texto: "A modificação unilateral do contrato administrativo deve ser justificada no âmbito de processo administrativo, contendo motivação sobre fato ocorrido ou conhecido após a celebração do contrato, não cabendo invocação de interesse público genérico, abstrato e indeterminado.",
    artigosVinculados: ["104-I"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Alteração Contratual Unilateral"
  },
  {
    id: "IBDA-39",
    orgao: "IBDA",
    numero: 39,
    texto: "As prorrogações de vigência contratual, a que se refere o art. 107 da Lei n. 14.133/2021, não precisam ser estabelecidas por iguais períodos.",
    artigosVinculados: ["107"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Prorrogação Contratual"
  },
  {
    id: "IBDA-40",
    orgao: "IBDA",
    numero: 40,
    texto: "Em contratos de terceirização com mão de obra exclusiva, caso não seja demonstrado, dentro do prazo estabelecido no contrato, o cumprimento das obrigações trabalhistas dos empregados alocados na execução dos serviços, será possível a retenção cautelar de valores devidos pela Administração à contratada, proporcionalmente ao montante do direito devido aos empregados.",
    artigosVinculados: ["121", "143"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Terceirização - Retenção Cautelar"
  },
  {
    id: "IBDA-41",
    orgao: "IBDA",
    numero: 41,
    texto: "No dever de resposta previsto no art. 123 da Lei n. 14.133/2021, ainda que considere o requerimento impertinente, protelatório ou de nenhum interesse para a boa execução do contrato, a Administração deve respondê-lo, informando sua negativa em razão de uma ou mais dessas características do requerimento, dentro do prazo estabelecido.",
    artigosVinculados: ["123"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Dever de Resposta"
  },
  {
    id: "IBDA-42",
    orgao: "IBDA",
    numero: 42,
    texto: "Nas hipóteses listadas no § 2º do art. 137, a Lei n. 14.133/2021 assegura ao contratado o direito de requerer a extinção contratual, oportunidade em que a Administração deverá, tão somente, avaliar a ocorrência de uma das hipóteses legais previstas e, em caso positivo, deferir o pedido.",
    artigosVinculados: ["137"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Extinção Contratual"
  },
  {
    id: "IBDA-43",
    orgao: "IBDA",
    numero: 43,
    texto: "O direito de suspensão, pelo contratado, do cumprimento de obrigações contratuais, previsto no inciso II do § 3º do art. 137 da Lei n. 14.133/2021, será exercido no âmbito administrativo, não dependendo de provimento jurisdicional.",
    artigosVinculados: ["137"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Suspensão de Obrigações"
  },
  {
    id: "IBDA-44",
    orgao: "IBDA",
    numero: 44,
    texto: "O § 4º do art. 137 da Lei n. 14.133/2021 autoriza os emitentes das garantias a participarem do processo de apuração de irregularidade, havendo a necessidade de notificação do garantidor para assegurar o devido processo legal.",
    artigosVinculados: ["137"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Garantias - Processo de Apuração"
  },
  {
    id: "IBDA-45",
    orgao: "IBDA",
    numero: 45,
    texto: "É obrigatório o saneamento de vícios constantes de licitações e contratos administrativos, nos termos do art. 147 da Lei n. 14.133/21.",
    artigosVinculados: ["147"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Saneamento de Vícios"
  },
  {
    id: "IBDA-46",
    orgao: "IBDA",
    numero: 46,
    texto: "Os parâmetros dos arts. 147 a 150 também são aplicáveis às licitações e contratos regidos pelas leis n. 8.666/1993, n. 10.520/2002 e n. 12.462/2011.",
    artigosVinculados: ["147", "148", "149", "150"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Direito Intertemporal"
  },
  {
    id: "IBDA-47",
    orgao: "IBDA",
    numero: 47,
    texto: "Os aspectos exemplificativamente indicados nos incisos do art. 147 da Lei n. 14.133/2021 servem de parâmetro para órgãos de controle cumprirem o dever, decorrente do art. 20 da LINDB, de avaliar as consequências práticas de suas decisões relacionadas a licitações e contratos.",
    artigosVinculados: ["147"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Controle - LINDB"
  },
  {
    id: "IBDA-48",
    orgao: "IBDA",
    numero: 48,
    texto: "Na hipótese de reconhecimento de vícios insanáveis nos contratos administrativos, restando demonstrado que a interrupção ou o desfazimento gerará maiores ônus ao interesse público primário do que a sua manutenção, deve-se preservar a avença, resolvendo-se os efeitos da nulidade pela indenização por perdas e danos, com apuração das responsabilidades cabíveis, se for o caso.",
    artigosVinculados: ["148"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Vícios Insanáveis"
  },
  {
    id: "IBDA-49",
    orgao: "IBDA",
    numero: 49,
    texto: "Os métodos consensuais de resolução de disputas previstos na Lei n. 14.133/2021 permitem a utilização da celebração de compromisso para eliminar irregularidade, incerteza jurídica ou situação contenciosa, nos termos dos arts. 26 e 27 da LINDB.",
    artigosVinculados: ["151"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Resolução de Disputas"
  },
  {
    id: "IBDA-50",
    orgao: "IBDA",
    numero: 50,
    texto: "O rol do parágrafo único do art. 151 da Lei n. 14.133/2021 tem caráter exemplificativo sobre controvérsias relacionadas a direitos patrimoniais disponíveis.",
    artigosVinculados: ["151"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Resolução de Disputas"
  },
  {
    id: "IBDA-51",
    orgao: "IBDA",
    numero: 51,
    texto: "Os métodos alternativos, adequados ou multiportas de resolução e prevenção de disputas são estimulados pela Lei n. 14.133/2021, cujo rol constante do art. 151 é exemplificativo.",
    artigosVinculados: ["151"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Resolução de Disputas"
  },
  {
    id: "IBDA-52",
    orgao: "IBDA",
    numero: 52,
    texto: "É dever da Administração, mediante decisão da autoridade competente, receber e analisar as propostas de acordos administrativos apresentadas pelo contratado durante a execução do ajuste, inclusive na fase executória da sanção aplicada. A recusa ou a celebração do acordo deve ser motivada nos autos do processo administrativo.",
    artigosVinculados: ["156"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Acordos Administrativos"
  },
  {
    id: "IBDA-53",
    orgao: "IBDA",
    numero: 53,
    texto: "O art. 159 da Lei n. 14.133/2021, ao determinar o processamento conjunto das infrações nela previstas, ou em outras leis de licitações e contratos da Administração Pública, que também sejam tipificadas no art. 5º da Lei n. 12.846/2013, não admite aplicação dúplice da penalidade de multa, em razão do princípio non bis in idem.",
    artigosVinculados: ["159"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Non Bis In Idem"
  },
  {
    id: "IBDA-54",
    orgao: "IBDA",
    numero: 54,
    texto: "A pedido do licitante ou contratado, poderá ser reconhecido o cumprimento dos requisitos para reabilitação antes do decurso dos prazos previstos no inciso III do art. 163 da Lei n. 14.133/2021, situação na qual a decisão que lhe for favorável terá eficácia a partir do decurso do prazo estipulado.",
    artigosVinculados: ["163-III"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Reabilitação"
  },
  {
    id: "IBDA-55",
    orgao: "IBDA",
    numero: 55,
    texto: "No âmbito das licitações e contratos administrativos, é possível a celebração de acordos com a Administração, com o objetivo de isentar ou atenuar a aplicação das sanções previstas na Lei n. 14.133/2021.",
    artigosVinculados: ["163"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Acordos - Sanções"
  },
  {
    id: "IBDA-56",
    orgao: "IBDA",
    numero: 56,
    texto: "A manifestação de intenção de recurso não exige motivação pelo licitante.",
    artigosVinculados: ["165"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Recurso - Manifestação de Intenção"
  },
  {
    id: "IBDA-57",
    orgao: "IBDA",
    numero: 57,
    texto: "Cabe à autoridade máxima do órgão ou entidade, na forma do regulamento, garantir o suporte necessário de recursos humanos, materiais e tecnologia, para que os controles internos a que se refere o art. 169, II e III, da Lei n. 14.133/2021 desenvolvam atividades de controle, inspeção, fiscalização e auditoria, com autonomia técnica, a fim de assegurar a boa gestão de licitações e contratos.",
    artigosVinculados: ["169-II", "169-III"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Controle Interno"
  },
  {
    id: "IBDA-58",
    orgao: "IBDA",
    numero: 58,
    texto: "Sem prejuízo dos pressupostos legais de admissibilidade, os órgãos de controle considerarão os critérios de oportunidade, materialidade, relevância e risco na seleção de fiscalizações e outras ações de controle relacionadas a licitações e contratos regidos pela Lei n. 14.133/2021, inclusive aquelas voltadas à apuração de denúncias e representações, com vistas à eficiência e à racionalidade administrativa.",
    artigosVinculados: ["170"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Controle Externo"
  },
  {
    id: "IBDA-59",
    orgao: "IBDA",
    numero: 59,
    texto: "Nas ações de controle relacionadas a licitações e contratos regidos pela Lei n. 14.133/2021, ao identificar não conformidades, os órgãos de controle assegurarão o contraditório e a ampla defesa, diferenciarão as impropriedades formais das irregularidades que configuram dano à Administração, bem como considerarão os efeitos práticos de suas decisões.",
    artigosVinculados: ["170"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Controle - Consequencialismo"
  },
  {
    id: "IBDA-60",
    orgao: "IBDA",
    numero: 60,
    texto: "A atuação dos tribunais de contas nas representações previstas no art. 170, § 4º, da Lei n. 14.133/2021, não está condicionada à prévia provocação de outros órgãos, entidades e agentes.",
    artigosVinculados: ["170"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Tribunais de Contas"
  },
  {
    id: "IBDA-61",
    orgao: "IBDA",
    numero: 61,
    texto: "Há possibilidade de adesão à ata de registro de preços vigente celebrada com base na Lei n. 8.666/1993, mesmo após sua revogação.",
    artigosVinculados: ["191"],
    jornada: "III Jornada de Direito Administrativo",
    data: "2024-11-07",
    url: "https://ibda.com.br/wp-content/uploads/2024/12/Enunciados-sobre-a-Lei-14.133-21-p1-1.pdf",
    tema: "Direito Intertemporal - Registro de Preços"
  },

  // ==================== INCP - Instituto Nacional da Contratação Pública ====================
  // 1ª Reunião Técnica INCP (2024)
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
  // 2ª Reunião Técnica INCP (2024-12-14)
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
];

// Metadados por órgão
export const ENUNCIADOS_METADATA: Record<string, EnunciadoMetadata> = {
  CJF: {
    fonte: "Conselho da Justiça Federal - CJF",
    totalEnunciados: 25,
    urlOficial: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/licita-contat-jf",
    evento: "1º Simpósio de Licitações e Contratos da Justiça Federal",
    data: "2022-08-16"
  },
  IBDA: {
    fonte: "Instituto Brasileiro de Direito Administrativo - IBDA",
    totalEnunciados: 61,
    urlOficial: "https://ibda.com.br/",
    evento: "III Jornada de Direito Administrativo",
    data: "2024-11-07"
  },
  INCP: {
    fonte: "Instituto Nacional da Contratação Pública - INCP",
    totalEnunciados: 43,
    urlOficial: "https://infranca.com.br/",
    evento: "1ª e 2ª Reunião Técnica INCP",
    data: "2024"
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
