/**
 * Lei 14.133/2021 - Nova Lei de Licitações e Contratos Administrativos
 * Referência completa dos 193 artigos para catalogação de materiais
 * CORRIGIDO: Estrutura revisada conforme texto oficial da lei
 */

export interface LeiArticle {
  numero: string;
  ementa: string; // Agora contém o texto oficial completo do artigo
  capitulo: string;
  secao?: string;
  titulo?: string; // Ex: "TÍTULO I - DISPOSIÇÕES PRELIMINARES"
  capituloCompleto?: string; // Ex: "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI"
}

export const LEI_14133_ARTIGOS: Record<string, LeiArticle> = {
  // TÍTULO I - DISPOSIÇÕES GERAIS
  // CAPÍTULO I - DAS DISPOSIÇÕES PRELIMINARES (Arts. 1 a 4)
  "1": {
    numero: "1",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI",
    ementa: "Art. 1º Esta Lei estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios, e abrange:\n\nI - os órgãos dos Poderes Legislativo e Judiciário da União, dos Estados e do Distrito Federal e os órgãos do Poder Legislativo dos Municípios, quando no desempenho de função administrativa;\n\nII - os fundos especiais e as demais entidades controladas direta ou indiretamente pela Administração Pública.\n\n§ 1º Não são abrangidas por esta Lei as empresas públicas, as sociedades de economia mista e as suas subsidiárias, regidas pela Lei nº 13.303, de 30 de junho de 2016, ressalvado o disposto no",
    capitulo: "TÍTULO I - CAPÍTULO I",
    secao: "Disposições Preliminares"
  },
  "2": {
    numero: "2",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI",
    ementa: "Art. 2º Esta Lei aplica-se a:\n\nI - alienação e concessão de direito real de uso de bens;\n\nII - compra, inclusive por encomenda;\n\nIII - locação;\n\nIV - concessão e permissão de uso de bens públicos;\n\nV - prestação de serviços, inclusive os técnico-profissionais especializados;\n\nVI - obras e serviços de arquitetura e engenharia;\n\nVII - contratações de tecnologia da informação e de comunicação.",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "3": {
    numero: "3",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI",
    ementa: "Art. 3º Não se subordinam ao regime desta Lei:\n\nI - contratos que tenham por objeto operação de crédito, interno ou externo, e gestão de dívida pública, incluídas as contratações de agente financeiro e a concessão de garantia relacionadas a esses contratos;\n\nII - contratações sujeitas a normas previstas em legislação própria.",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "4": {
    numero: "4",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI",
    ementa: "Art. 4º Aplicam-se às licitações e contratos disciplinados por esta Lei as disposições constantes dos arts. 42 a 49 da Lei Complementar nº 123, de 14 de dezembro de 2006.\n\n§ 1º As disposições a que se refere o caput deste artigo não são aplicadas:\n\nI - no caso de licitação para aquisição de bens ou contratação de serviços em geral, ao item cujo valor estimado for superior à receita bruta máxima admitida para fins de enquadramento como empresa de pequeno porte;\n\nII - no caso de contratação de obras e serviços de engenharia, às licitações cujo valor estimado for superior à receita bruta máxima admitida para fins de enquadramento como empresa de pequeno porte.\n\n§ 2º A obtenção de benefícios a que se refere o caput deste artigo fica limitada às microempresas e às empresas de pequeno porte que, no ano-calendário de realização da licitação, ainda não tenham celebrado contratos com a Administração Pública cujos valores somados extrapolem a receita bruta máxima admitida para fins de enquadramento como empresa de pequeno porte, devendo o órgão ou entidade exigir do licitante declaração de observância desse limite na licitação.\n\n§ 3º Nas contratações com prazo de vigência superior a 1 (um) ano, será considerado o valor anual do contrato na aplicação dos limites previstos nos §§ 1º e 2º deste artigo. DOS PRINCÍPIOS",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },

  // CAPÍTULO II - DOS PRINCÍPIOS (Art. 5)
  "5": {
    numero: "5",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO II - DOS PRINCÍPIOS",
    ementa: "Art. 5º Na aplicação desta Lei, serão observados os princípios da legalidade, da impessoalidade, da moralidade, da publicidade, da eficiência, do interesse público, da probidade administrativa, da igualdade, do planejamento, da transparência, da eficácia, da segregação de funções, da motivação, da vinculação ao edital, do julgamento objetivo, da segurança jurídica, da razoabilidade, da competitividade, da proporcionalidade, da celeridade, da economicidade e do desenvolvimento nacional sustentável, assim como as disposições do Decreto-Lei nº 4.657, de 4 de setembro de 1942 (Lei de Introdução às Normas do Direito Brasileiro). DAS DEFINIÇÕES",
    capitulo: "TÍTULO I - CAPÍTULO II",
    secao: "Princípios"
  },

  // CAPÍTULO III - DAS DEFINIÇÕES (Art. 6)
  "6": {
    numero: "6",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO III - DAS DEFINIÇÕES",
    ementa: "Art. 6º Para os fins desta Lei, consideram-se:\n\nI - órgão: unidade de atuação integrante da estrutura da Administração Pública;\n\nII - entidade: unidade de atuação dotada de personalidade jurídica;\n\nIII - Administração Pública: administração direta e indireta da União, dos Estados, do Distrito Federal e dos Municípios, inclusive as entidades com personalidade jurídica de direito privado sob controle do poder público e as fundações por ele instituídas ou mantidas;\n\nIV - Administração: órgão ou entidade por meio do qual a Administração Pública atua;\n\nV - agente público: indivíduo que, em virtude de eleição, nomeação, designação, contratação ou qualquer outra forma de investidura ou vínculo, exerce mandato, cargo, emprego ou função em pessoa jurídica integrante da Administração Pública;\n\nVI - autoridade: agente público dotado de poder de decisão;\n\nVII - contratante: pessoa jurídica integrante da Administração Pública responsável pela contratação;\n\nVIII - contratado: pessoa física ou jurídica, ou consórcio de pessoas jurídicas, signatária de contrato com a Administração;\n\nIX - licitante: pessoa física ou jurídica, ou consórcio de pessoas jurídicas, que participa ou manifesta a intenção de participar de processo licitatório, sendo-lhe equiparável, para os fins desta Lei, o fornecedor ou o prestador de serviço que, em atendimento à solicitação da Administração, oferece proposta;\n\nX - compra: aquisição remunerada de bens para fornecimento de uma só vez ou parceladamente, considerada imediata aquela com prazo de entrega de até 30 (trinta) dias da ordem de fornecimento;\n\nXI - serviço: atividade ou conjunto de atividades destinadas a obter determinada utilidade, intelectual ou material, de interesse da Administração;\n\nXII - obra: toda atividade estabelecida, por força de lei, como privativa das profissões de arquiteto e engenheiro que implica intervenção no meio ambiente por meio de um conjunto harmônico de ações que, agregadas, formam um todo que inova o espaço físico da natureza ou acarreta alteração substancial das características originais de bem imóvel; XIII - bens e serviços comuns: aqueles cujos padrões de desempenho e qualidade podem ser objetivamente definidos pelo edital, por meio de especificações usuais de mercado; XIV - bens e serviços especiais: aqueles que, por sua alta heterogeneidade ou complexidade, não podem ser descritos na forma do inciso XIII do caput deste artigo, exigida justificativa prévia do contratante; XV - serviços e fornecimentos contínuos: serviços contratados e compras realizadas pela Administração Pública para a manutenção da atividade administrativa, decorrentes de necessidades permanentes ou prolongadas; XVI - serviços contínuos com regime de dedicação exclusiva de mão de obra: aqueles cujo modelo de execução contratual exige, entre outros requisitos, que:\n\na) os empregados do contratado fiquem à disposição nas dependências do contratante para a prestação dos serviços;\n\nb) o contratado não compartilhe os recursos humanos e materiais disponíveis de uma contratação para execução simultânea de outros contratos;\n\nc) o contratado possibilite a fiscalização pelo contratante quanto à distribuição, controle e supervisão dos recursos humanos alocados aos seus contratos; XVII - serviços não contínuos ou contratados por escopo: aqueles que impõem ao contratado o dever de realizar a prestação de um serviço específico em período predeterminado, podendo ser prorrogado, desde que justificadamente, pelo prazo necessário à conclusão do objeto; XVIII - serviços técnicos especializados de natureza predominantemente intelectual: aqueles realizados em trabalhos relativos a:\n\na) estudos técnicos, planejamentos, projetos básicos e projetos executivos;\n\nb) pareceres, perícias e avaliações em geral;\n\nc) assessorias e consultorias técnicas e auditorias financeiras e tributárias;\n\nd) fiscalização, supervisão e gerenciamento de obras e serviços;\n\ne) patrocínio ou defesa de causas judiciais e administrativas;\n\nf) treinamento e aperfeiçoamento de pessoal; g) restauração de obras de arte e de bens de valor histórico; h) controles de qualidade e tecnológico, análises, testes e ensaios de campo e laboratoriais, instrumentação e monitoramento de parâmetros específicos de obras e do meio ambiente e demais serviços de engenharia que se enquadrem na definição deste inciso; XIX - notória especialização: qualidade de profissional ou de empresa cujo conceito, no campo de sua especialidade, decorrente de desempenho anterior, estudos, experiência, publicações, organização, aparelhamento, equipe técnica ou outros requisitos relacionados com suas atividades, permite inferir que o seu trabalho é essencial e reconhecidamente adequado à plena satisfação do objeto do contrato; XX - estudo técnico preliminar: documento constitutivo da primeira etapa do planejamento de uma contratação que caracteriza o interesse público envolvido e a sua melhor solução e dá base ao anteprojeto, ao termo de referência ou ao projeto básico a serem elaborados caso se conclua pela viabilidade da contratação; XXI - serviço de engenharia: toda atividade ou conjunto de atividades destinadas a obter determinada utilidade, intelectual ou material, de interesse para a Administração e que, não enquadradas no conceito de obra a que se refere o inciso XII do caput deste artigo, são estabelecidas, por força de lei, como privativas das profissões de arquiteto e engenheiro ou de técnicos especializados, que compreendem:\n\na) serviço comum de engenharia: todo serviço de engenharia que tem por objeto ações, objetivamente padronizáveis em termos de desempenho e qualidade, de manutenção, de adequação e de adaptação de bens móveis e imóveis, com preservação das características originais dos bens;\n\nb) serviço especial de engenharia: aquele que, por sua alta heterogeneidade ou complexidade, não pode se enquadrar na definição constante da alínea a deste inciso; XXII - obras, serviços e fornecimentos de grande vulto: aqueles cujo valor estimado supera R$ 200.000.000,00 (duzentos milhões de reais); (Vide Decreto nº 10.922, de 2021) (Vigência) (Vide Decreto nº 11.317, de 2022) Vigência (Vide Decreto nº 11.871, de 2023) Vigência (Vide Decreto nº 12.343, de 2024) Vigência XXIII - termo de referência: documento necessário para a contratação de bens e serviços, que deve conter os seguintes parâmetros e elementos descritivos:\n\na) definição do objeto, incluídos sua natureza, os quantitativos, o prazo do contrato e, se for o caso, a possibilidade de sua prorrogação;\n\nb) fundamentação da contratação, que consiste na referência aos estudos técnicos preliminares correspondentes ou, quando não for possível divulgar esses estudos, no extrato das partes que não contiverem informações sigilosas;\n\nc) descrição da solução como um todo, considerado todo o ciclo de vida do objeto;\n\nd) requisitos da contratação;\n\ne) modelo de execução do objeto, que consiste na definição de como o contrato deverá produzir os resultados pretendidos desde o seu início até o seu encerramento;\n\nf) modelo de gestão do contrato, que descreve como a execução do objeto será acompanhada e fiscalizada pelo órgão ou entidade; g) critérios de medição e de pagamento; h) forma e critérios de seleção do fornecedor; i) estimativas do valor da contratação, acompanhadas dos preços unitários referenciais, das memórias de cálculo e dos documentos que lhe dão suporte, com os parâmetros utilizados para a obtenção dos preços e para os respectivos cálculos, que devem constar de documento separado e classificado; j) adequação orçamentária; XXIV - anteprojeto: peça técnica com todos os subsídios necessários à elaboração do projeto básico, que deve conter, no mínimo, os seguintes elementos:\n\na) demonstração e justificativa do programa de necessidades, avaliação de demanda do público-alvo, motivação técnico-econômico-social do empreendimento, visão global dos investimentos e definições relacionadas ao nível de serviço desejado;\n\nb) condições de solidez, de segurança e de durabilidade;\n\nc) prazo de entrega;\n\nd) estética do projeto arquitetônico, traçado geométrico e/ou projeto da área de influência, quando cabível;\n\ne) parâmetros de adequação ao interesse público, de economia na utilização, de facilidade na execução, de impacto ambiental e de acessibilidade;\n\nf) proposta de concepção da obra ou do serviço de engenharia; g) projetos anteriores ou estudos preliminares que embasaram a concepção proposta; h) levantamento topográfico e cadastral; i) pareceres de sondagem; j) memorial descritivo dos elementos da edificação, dos componentes construtivos e dos materiais de construção, de forma a estabelecer padrões mínimos para a contratação; XXV - projeto básico: conjunto de elementos necessários e suficientes, com nível de precisão adequado para definir e dimensionar a obra ou o serviço, ou o complexo de obras ou de serviços objeto da licitação, elaborado com base nas indicações dos estudos técnicos preliminares, que assegure a viabilidade técnica e o adequado tratamento do impacto ambiental do empreendimento e que possibilite a avaliação do custo da obra e a definição dos métodos e do prazo de execução, devendo conter os seguintes elementos:\n\na) levantamentos topográficos e cadastrais, sondagens e ensaios geotécnicos, ensaios e análises laboratoriais, estudos socioambientais e demais dados e levantamentos necessários para execução da solução escolhida;\n\nb) soluções técnicas globais e localizadas, suficientemente detalhadas, de forma a evitar, por ocasião da elaboração do projeto executivo e da realização das obras e montagem, a necessidade de reformulações ou variantes quanto à qualidade, ao preço e ao prazo inicialmente definidos;\n\nc) identificação dos tipos de serviços a executar e dos materiais e equipamentos a incorporar à obra, bem como das suas especificações, de modo a assegurar os melhores resultados para o empreendimento e a segurança executiva na utilização do objeto, para os fins a que se destina, considerados os riscos e os perigos identificáveis, sem frustrar o caráter competitivo para a sua execução;\n\nd) informações que possibilitem o estudo e a definição de métodos construtivos, de instalações provisórias e de condições organizacionais para a obra, sem frustrar o caráter competitivo para a sua execução;\n\ne) subsídios para montagem do plano de licitação e gestão da obra, compreendidos a sua programação, a estratégia de suprimentos, as normas de fiscalização e outros dados necessários em cada caso;\n\nf) orçamento detalhado do custo global da obra, fundamentado em quantitativos de serviços e fornecimentos propriamente avaliados, obrigatório exclusivamente para os regimes de execução previstos nos incisos I, II, III, IV e VII do caput do",
    capitulo: "TÍTULO I - CAPÍTULO III",
    secao: "Definições"
  },

  // CAPÍTULO IV - DOS AGENTES PÚBLICOS (Arts. 7 a 13)
  "7": {
    numero: "7",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 7º Caberá à autoridade máxima do órgão ou da entidade, ou a quem as normas de organização administrativa indicarem, promover gestão por competências e designar agentes públicos para o desempenho das funções essenciais à execução desta Lei que preencham os seguintes requisitos:\n\nI - sejam, preferencialmente, servidor efetivo ou empregado público dos quadros permanentes da Administração Pública;\n\nII - tenham atribuições relacionadas a licitações e contratos ou possuam formação compatível ou qualificação atestada por certificação profissional emitida por escola de governo criada e mantida pelo poder público; e\n\nIII - não sejam cônjuge ou companheiro de licitantes ou contratados habituais da Administração nem tenham com eles vínculo de parentesco, colateral ou por afinidade, até o terceiro grau, ou de natureza técnica, comercial, econômica, financeira, trabalhista e civil.\n\n§ 1º A autoridade referida no caput deste artigo deverá observar o princípio da segregação de funções, vedada a designação do mesmo agente público para atuação simultânea em funções mais suscetíveis a riscos, de modo a reduzir a possibilidade de ocultação de erros e de ocorrência de fraudes na respectiva contratação.\n\n§ 2º O disposto no caput e no\n\n§ 1º deste artigo, inclusive os requisitos estabelecidos, também se aplica aos órgãos de assessoramento jurídico e de controle interno da Administração.",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "8": {
    numero: "8",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 8º A licitação será conduzida por agente de contratação, pessoa designada pela autoridade competente, entre servidores efetivos ou empregados públicos dos quadros permanentes da Administração Pública, para tomar decisões, acompanhar o trâmite da licitação, dar impulso ao procedimento licitatório e executar quaisquer outras atividades necessárias ao bom andamento do certame até a homologação.\n\n§ 1º O agente de contratação será auxiliado por equipe de apoio e responderá individualmente pelos atos que praticar, salvo quando induzido a erro pela atuação da equipe.\n\n§ 2º Em licitação que envolva bens ou serviços especiais, desde que observados os requisitos estabelecidos no"c\" do inciso II do caput do art. 75 desta Lei.",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "9": {
    numero: "9",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 9º É vedado ao agente público designado para atuar na área de licitações e contratos, ressalvados os casos previstos em lei:\n\nI - admitir, prever, incluir ou tolerar, nos atos que praticar, situações que:\n\na) comprometam, restrinjam ou frustrem o caráter competitivo do processo licitatório, inclusive nos casos de participação de sociedades cooperativas;\n\nb) estabeleçam preferências ou distinções em razão da naturalidade, da sede ou do domicílio dos licitantes;\n\nc) sejam impertinentes ou irrelevantes para o objeto específico do contrato;\n\nII - estabelecer tratamento diferenciado de natureza comercial, legal, trabalhista, previdenciária ou qualquer outra entre empresas brasileiras e estrangeiras, inclusive no que se refere a moeda, modalidade e local de pagamento, mesmo quando envolvido financiamento de agência internacional;\n\nIII - opor resistência injustificada ao andamento dos processos e, indevidamente, retardar ou deixar de praticar ato de ofício, ou praticá-lo contra disposição expressa em lei.\n\n§ 1º Não poderá participar, direta ou indiretamente, da licitação ou da execução do contrato agente público de órgão ou entidade licitante ou contratante, devendo ser observadas as situações que possam configurar conflito de interesses no exercício ou após o exercício do cargo ou emprego, nos termos da legislação que disciplina a matéria.\n\n§ 2º As vedações de que trata este artigo estendem-se a terceiro que auxilie a condução da contratação na qualidade de integrante de equipe de apoio, profissional especializado ou funcionário ou representante de empresa que preste assessoria técnica.",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "10": {
    numero: "10",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 10º . Se as autoridades competentes e os servidores públicos que tiverem participado dos procedimentos relacionados às licitações e aos contratos de que trata esta Lei precisarem defender-se nas esferas administrativa, controladora ou judicial em razão de ato praticado com estrita observância de orientação constante em parecer jurídico elaborado na forma do\n\n§ 1º do",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "11": {
    numero: "11",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 11º . O processo licitatório tem por objetivos:\n\nI - assegurar a seleção da proposta apta a gerar o resultado de contratação mais vantajoso para a Administração Pública, inclusive no que se refere ao ciclo de vida do objeto;\n\nII - assegurar tratamento isonômico entre os licitantes, bem como a justa competição;\n\nIII - evitar contratações com sobrepreço ou com preços manifestamente inexequíveis e superfaturamento na execução dos contratos;\n\nIV - incentivar a inovação e o desenvolvimento nacional sustentável. Parágrafo único. A alta administração do órgão ou entidade é responsável pela governança das contratações e deve implementar processos e estruturas, inclusive de gestão de riscos e controles internos, para avaliar, direcionar e monitorar os processos licitatórios e os respectivos contratos, com o intuito de alcançar os objetivos estabelecidos no caput deste artigo, promover um ambiente íntegro e confiável, assegurar o alinhamento das contratações ao planejamento estratégico e às leis orçamentárias e promover eficiência, efetividade e eficácia em suas contratações.",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "12": {
    numero: "12",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 12º . No processo licitatório, observar-se-á o seguinte:\n\nI - os documentos serão produzidos por escrito, com data e local de sua realização e assinatura dos responsáveis;\n\nII - os valores, os preços e os custos utilizados terão como expressão monetária a moeda corrente nacional, ressalvado o disposto no",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "13": {
    numero: "13",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO IV - DOS AGENTES PÚBLICOS",
    ementa: "Art. 13º . Os atos praticados no processo licitatório são públicos, ressalvadas as hipóteses de informações cujo sigilo seja imprescindível à segurança da sociedade e do Estado, na forma da lei. Parágrafo único. A publicidade será diferida:\n\nI - quanto ao conteúdo das propostas, até a respectiva abertura;\n\nII - quanto ao orçamento da Administração, nos termos do",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },

  // CAPÍTULO V - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE (Arts. 14 a 17)
  "14": {
    numero: "14",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO V - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE",
    ementa: "Art. 14º . Não poderão disputar licitação ou participar da execução de contrato, direta ou indiretamente:\n\nI - autor do anteprojeto, do projeto básico ou do projeto executivo, pessoa física ou jurídica, quando a licitação versar sobre obra, serviços ou fornecimento de bens a ele relacionados;\n\nII - empresa, isoladamente ou em consórcio, responsável pela elaboração do projeto básico ou do projeto executivo, ou empresa da qual o autor do projeto seja dirigente, gerente, controlador, acionista ou detentor de mais de 5% (cinco por cento) do capital com direito a voto, responsável técnico ou subcontratado, quando a licitação versar sobre obra, serviços ou fornecimento de bens a ela necessários;\n\nIII - pessoa física ou jurídica que se encontre, ao tempo da licitação, impossibilitada de participar da licitação em decorrência de sanção que lhe foi imposta;\n\nIV - aquele que mantenha vínculo de natureza técnica, comercial, econômica, financeira, trabalhista ou civil com dirigente do órgão ou entidade contratante ou com agente público que desempenhe função na licitação ou atue na fiscalização ou na gestão do contrato, ou que deles seja cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, devendo essa proibição constar expressamente do edital de licitação;\n\nV - empresas controladoras, controladas ou coligadas, nos termos da Lei nº 6.404, de 15 de dezembro de 1976, concorrendo entre si;\n\nVI - pessoa física ou jurídica que, nos 5 (cinco) anos anteriores à divulgação do edital, tenha sido condenada judicialmente, com trânsito em julgado, por exploração de trabalho infantil, por submissão de trabalhadores a condições análogas às de escravo ou por contratação de adolescentes nos casos vedados pela legislação trabalhista.\n\n§ 1º O impedimento de que trata o inciso III do caput deste artigo será também aplicado ao licitante que atue em substituição a outra pessoa, física ou jurídica, com o intuito de burlar a efetividade da sanção a ela aplicada, inclusive a sua controladora, controlada ou coligada, desde que devidamente comprovado o ilícito ou a utilização fraudulenta da personalidade jurídica do licitante.\n\n§ 2º A critério da Administração e exclusivamente a seu serviço, o autor dos projetos e a empresa a que se referem os incisos I e II do caput deste artigo poderão participar no apoio das atividades de planejamento da contratação, de execução da licitação ou de gestão do contrato, desde que sob supervisão exclusiva de agentes públicos do órgão ou entidade.\n\n§ 3º Equiparam-se aos autores do projeto as empresas integrantes do mesmo grupo econômico.\n\n§ 4º O disposto neste artigo não impede a licitação ou a contratação de obra ou serviço que inclua como encargo do contratado a elaboração do projeto básico e do projeto executivo, nas contratações integradas, e do projeto executivo, nos demais regimes de execução.\n\n§ 5º Em licitações e contratações realizadas no âmbito de projetos e programas parcialmente financiados por agência oficial de cooperação estrangeira ou por organismo financeiro internacional com recursos do financiamento ou da contrapartida nacional, não poderá participar pessoa física ou jurídica que integre o rol de pessoas sancionadas por essas entidades ou que seja declarada inidônea nos termos desta Lei.",
    capitulo: "TÍTULO I - CAPÍTULO V",
    secao: "Órgãos de Assessoramento e Controle"
  },
  "15": {
    numero: "15",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO V - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE",
    ementa: "Art. 15º . Salvo vedação devidamente justificada no processo licitatório, pessoa jurídica poderá participar de licitação em consórcio, observadas as seguintes normas:\n\nI - comprovação de compromisso público ou particular de constituição de consórcio, subscrito pelos consorciados;\n\nII - indicação da empresa líder do consórcio, que será responsável por sua representação perante a Administração;\n\nIII - admissão, para efeito de habilitação técnica, do somatório dos quantitativos de cada consorciado e, para efeito de habilitação econômico-financeira, do somatório dos valores de cada consorciado;\n\nIV - impedimento de a empresa consorciada participar, na mesma licitação, de mais de um consórcio ou de forma isolada;\n\nV - responsabilidade solidária dos integrantes pelos atos praticados em consórcio, tanto na fase de licitação quanto na de execução do contrato.\n\n§ 1º O edital deverá estabelecer para o consórcio acréscimo de 10% (dez por cento) a 30% (trinta por cento) sobre o valor exigido de licitante individual para a habilitação econômico-financeira, salvo justificação.\n\n§ 2º O acréscimo previsto no\n\n§ 1º deste artigo não se aplica aos consórcios compostos, em sua totalidade, de microempresas e pequenas empresas, assim definidas em lei.\n\n§ 3º O licitante vencedor é obrigado a promover, antes da celebração do contrato, a constituição e o registro do consórcio, nos termos do compromisso referido no inciso I do caput deste artigo.\n\n§ 4º Desde que haja justificativa técnica aprovada pela autoridade competente, o edital de licitação poderá estabelecer limite máximo para o número de empresas consorciadas.\n\n§ 5º A substituição de consorciado deverá ser expressamente autorizada pelo órgão ou entidade contratante e condicionada à comprovação de que a nova empresa do consórcio possui, no mínimo, os mesmos quantitativos para efeito de habilitação técnica e os mesmos valores para efeito de qualificação econômico-financeira apresentados pela empresa substituída para fins de habilitação do consórcio no processo licitatório que originou o contrato.",
    capitulo: "TÍTULO I - CAPÍTULO V",
    secao: "Órgãos de Assessoramento e Controle"
  },
  "16": {
    numero: "16",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO V - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE",
    ementa: "Art. 16º . Os profissionais organizados sob a forma de cooperativa poderão participar de licitação quando:\n\nI - a constituição e o funcionamento da cooperativa observarem as regras estabelecidas na legislação aplicável, em especial a Lei nº 5.764, de 16 de dezembro de 1971, a Lei nº 12.690, de 19 de julho de 2012, e a Lei Complementar nº 130, de 17 de abril de 2009;\n\nII - a cooperativa apresentar demonstrativo de atuação em regime cooperado, com repartição de receitas e despesas entre os cooperados;\n\nIII - qualquer cooperado, com igual qualificação, for capaz de executar o objeto contratado, vedado à Administração indicar nominalmente pessoas;\n\nIV - o objeto da licitação referir-se, em se tratando de cooperativas enquadradas na Lei nº 12.690, de 19 de julho de 2012, a serviços especializados constantes do objeto social da cooperativa, a serem executados de forma complementar à sua atuação.",
    capitulo: "TÍTULO I - CAPÍTULO V",
    secao: "Órgãos de Assessoramento e Controle"
  },
  "17": {
    numero: "17",
    titulo: "TÍTULO I - DISPOSIÇÕES PRELIMINARES",
    capituloCompleto: "CAPÍTULO V - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE",
    ementa: "Art. 17º . O processo de licitação observará as seguintes fases, em sequência:\n\nI - preparatória;\n\nII - de divulgação do edital de licitação;\n\nIII - de apresentação de propostas e lances, quando for o caso;\n\nIV - de julgamento;\n\nV - de habilitação;\n\nVI - recursal;\n\nVII - de homologação.\n\n§ 1º A fase referida no inciso V do caput deste artigo poderá, mediante ato motivado com explicitação dos benefícios decorrentes, anteceder as fases referidas nos incisos III e IV do caput deste artigo, desde que expressamente previsto no edital de licitação.\n\n§ 2º As licitações serão realizadas preferencialmente sob a forma eletrônica, admitida a utilização da forma presencial, desde que motivada, devendo a sessão pública ser registrada em ata e gravada em áudio e vídeo.\n\n§ 3º Desde que previsto no edital, na fase a que se refere o inciso IV do caput deste artigo, o órgão ou entidade licitante poderá, em relação ao licitante provisoriamente vencedor, realizar análise e avaliação da conformidade da proposta, mediante homologação de amostras, exame de conformidade e prova de conceito, entre outros testes de interesse da Administração, de modo a comprovar sua aderência às especificações definidas no termo de referência ou no projeto básico.\n\n§ 4º Nos procedimentos realizados por meio eletrônico, a Administração poderá determinar, como condição de validade e eficácia, que os licitantes pratiquem seus atos em formato eletrônico.\n\n§ 5º Na hipótese excepcional de licitação sob a forma presencial a que refere o\n\n§ 2º deste artigo, a sessão pública de apresentação de propostas deverá ser gravada em áudio e vídeo, e a gravação será juntada aos autos do processo licitatório depois de seu encerramento.\n\n§ 6º A Administração poderá exigir certificação por organização independente acreditada pelo Instituto Nacional de Metrologia, Qualidade e Tecnologia (Inmetro) como condição para aceitação de:\n\nI - estudos, anteprojetos, projetos básicos e projetos executivos;\n\nII - conclusão de fases ou de objetos de contratos;\n\nIII - material e corpo técnico apresentados por empresa para fins de habilitação. DA FASE PREPARATÓRIA Da Instrução do Processo Licitatório",
    capitulo: "TÍTULO I - CAPÍTULO V",
    secao: "Órgãos de Assessoramento e Controle"
  },

  // TÍTULO II - DAS LICITAÇÕES
  // CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES
  // SEÇÃO I - DAS REGRAS APLICÁVEIS ÀS LICITAÇÕES (Arts. 18 a 21)
  "18": {
    numero: "18",
    titulo: "TÍTULO II - DAS LICITAÇÕES",
    capituloCompleto: "CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES - SEÇÃO I - DAS REGRAS APLICÁVEIS ÀS LICITAÇÕES",
    ementa: "Art. 18º . A fase preparatória do processo licitatório é caracterizada pelo planejamento e deve compatibilizar-se com o plano de contratações anual de que trata o inciso VII do caput do",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I",
    secao: "Regras Gerais das Licitações"
  },
  "19": {
    numero: "19",
    titulo: "TÍTULO II - DAS LICITAÇÕES",
    capituloCompleto: "CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES - SEÇÃO I - DAS REGRAS APLICÁVEIS ÀS LICITAÇÕES",
    ementa: "Art. 19º . Os órgãos da Administração com competências regulamentares relativas às atividades de administração de materiais, de obras e serviços e de licitações e contratos deverão:\n\nI - instituir instrumentos que permitam, preferencialmente, a centralização dos procedimentos de aquisição e contratação de bens e serviços;\n\nII - criar catálogo eletrônico de padronização de compras, serviços e obras, admitida a adoção do catálogo do Poder Executivo federal por todos os entes federativos;\n\nIII - instituir sistema informatizado de acompanhamento de obras, inclusive com recursos de imagem e vídeo;\n\nIV - instituir, com auxílio dos órgãos de assessoramento jurídico e de controle interno, modelos de minutas de editais, de termos de referência, de contratos padronizados e de outros documentos, admitida a adoção das minutas do Poder Executivo federal por todos os entes federativos;\n\nV - promover a adoção gradativa de tecnologias e processos integrados que permitam a criação, a utilização e a atualização de modelos digitais de obras e serviços de engenharia.\n\n§ 1º O catálogo referido no inciso II do caput deste artigo poderá ser utilizado em licitações cujo critério de julgamento seja o de menor preço ou o de maior desconto e conterá toda a documentação e os procedimentos próprios da fase interna de licitações, assim como as especificações dos respectivos objetos, conforme disposto em regulamento.\n\n§ 2º A não utilização do catálogo eletrônico de padronização de que trata o inciso II do caput ou dos modelos de minutas de que trata o inciso IV do caput deste artigo deverá ser justificada por escrito e anexada ao respectivo processo licitatório.\n\n§ 3º Nas licitações de obras e serviços de engenharia e arquitetura, sempre que adequada ao objeto da licitação, será preferencialmente adotada a Modelagem da Informação da Construção (Building Information Modelling - BIM) ou tecnologias e processos integrados similares ou mais avançados que venham a substituí-la.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I",
    secao: "Regras Gerais das Licitações"
  },
  "20": {
    numero: "20",
    titulo: "TÍTULO II - DAS LICITAÇÕES",
    capituloCompleto: "CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES - SEÇÃO I - DAS REGRAS APLICÁVEIS ÀS LICITAÇÕES",
    ementa: "Art. 20º . Os itens de consumo adquiridos para suprir as demandas das estruturas da Administração Pública deverão ser de qualidade comum, não superior à necessária para cumprir as finalidades às quais se destinam, vedada a aquisição de artigos de luxo. Regulamento (Vigência)\n\n§ 1º Os Poderes Executivo, Legislativo e Judiciário definirão em regulamento os limites para o enquadramento dos bens de consumo nas categorias comum e luxo.\n\n§ 2º A partir de 180 (cento e oitenta) dias contados da promulgação desta Lei, novas compras de bens de consumo só poderão ser efetivadas com a edição, pela autoridade competente, do regulamento a que se refere o\n\n§ 1º deste artigo.\n\n§ 3º (VETADO).",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I",
    secao: "Regras Gerais das Licitações"
  },
  "21": {
    numero: "21",
    titulo: "TÍTULO II - DAS LICITAÇÕES",
    capituloCompleto: "CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES - SEÇÃO I - DAS REGRAS APLICÁVEIS ÀS LICITAÇÕES",
    ementa: "Art. 21º . A Administração poderá convocar, com antecedência mínima de 8 (oito) dias úteis, audiência pública, presencial ou a distância, na forma eletrônica, sobre licitação que pretenda realizar, com disponibilização prévia de informações pertinentes, inclusive de estudo técnico preliminar e elementos do edital de licitação, e com possibilidade de manifestação de todos os interessados. Parágrafo único. A Administração também poderá submeter a licitação a prévia consulta pública, mediante a disponibilização de seus elementos a todos os interessados, que poderão formular sugestões no prazo fixado.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I",
    secao: "Regras Gerais das Licitações"
  },

  // SEÇÃO II - DO PLANEJAMENTO DA CONTRATAÇÃO (Arts. 22 a 25)
  "22": {
    numero: "22",
    titulo: "TÍTULO II - DAS LICITAÇÕES",
    capituloCompleto: "CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES - SEÇÃO II - DO PLANEJAMENTO DA CONTRATAÇÃO",
    ementa: "Art. 22º . O edital poderá contemplar matriz de alocação de riscos entre o contratante e o contratado, hipótese em que o cálculo do valor estimado da contratação poderá considerar taxa de risco compatível com o objeto da licitação e com os riscos atribuídos ao contratado, de acordo com metodologia predefinida pelo ente federativo.\n\n§ 1º A matriz de que trata o caput deste artigo deverá promover a alocação eficiente dos riscos de cada contrato e estabelecer a responsabilidade que caiba a cada parte contratante, bem como os mecanismos que afastem a ocorrência do sinistro e mitiguem os seus efeitos, caso este ocorra durante a execução contratual.\n\n§ 2º O contrato deverá refletir a alocação realizada pela matriz de riscos, especialmente quanto:\n\nI - às hipóteses de alteração para o restabelecimento da equação econômico-financeira do contrato nos casos em que o sinistro seja considerado na matriz de riscos como causa de desequilíbrio não suportada pela parte que pretenda o restabelecimento;\n\nII - à possibilidade de resolução quando o sinistro majorar excessivamente ou impedir a continuidade da execução contratual;\n\nIII - à contratação de seguros obrigatórios previamente definidos no contrato, integrado o custo de contratação ao preço ofertado.\n\n§ 3º Quando a contratação se referir a obras e serviços de grande vulto ou forem adotados os regimes de contratação integrada e semi-integrada, o edital obrigatoriamente contemplará matriz de alocação de riscos entre o contratante e o contratado.\n\n§ 4º Nas contratações integradas ou semi-integradas, os riscos decorrentes de fatos supervenientes à contratação associados à escolha da solução de projeto básico pelo contratado deverão ser alocados como de sua responsabilidade na matriz de riscos.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II",
    secao: "Planejamento da Contratação"
  },
  "23": {
    numero: "23",
    ementa: "Art. 23º . O valor previamente estimado da contratação deverá ser compatível com os valores praticados pelo mercado, considerados os preços constantes de bancos de dados públicos e as quantidades a serem contratadas, observadas a potencial economia de escala e as peculiaridades do local de execução do objeto.\n\n§ 1º No processo licitatório para aquisição de bens e contratação de serviços em geral, conforme regulamento, o valor estimado será definido com base no melhor preço aferido por meio da utilização dos seguintes parâmetros, adotados de forma combinada ou não:\n\nI - composição de custos unitários menores ou iguais à mediana do item correspondente no painel para consulta de preços ou no banco de preços em saúde disponíveis no Portal Nacional de Contratações Públicas (PNCP);\n\nII - contratações similares feitas pela Administração Pública, em execução ou concluídas no período de 1 (um) ano anterior à data da pesquisa de preços, inclusive mediante sistema de registro de preços, observado o índice de atualização de preços correspondente;\n\nIII - utilização de dados de pesquisa publicada em mídia especializada, de tabela de referência formalmente aprovada pelo Poder Executivo federal e de sítios eletrônicos especializados ou de domínio amplo, desde que contenham a data e hora de acesso;\n\nIV - pesquisa direta com no mínimo 3 (três) fornecedores, mediante solicitação formal de cotação, desde que seja apresentada justificativa da escolha desses fornecedores e que não tenham sido obtidos os orçamentos com mais de 6 (seis) meses de antecedência da data de divulgação do edital;\n\nV - pesquisa na base nacional de notas fiscais eletrônicas, na forma de regulamento.\n\n§ 2º No processo licitatório para contratação de obras e serviços de engenharia, conforme regulamento, o valor estimado, acrescido do percentual de Benefícios e Despesas Indiretas (BDI) de referência e dos Encargos Sociais (ES) cabíveis, será definido por meio da utilização de parâmetros na seguinte ordem:\n\nI - composição de custos unitários menores ou iguais à mediana do item correspondente do Sistema de Custos Referenciais de Obras (Sicro), para serviços e obras de infraestrutura de transportes, ou do Sistema Nacional de Pesquisa de Custos e Índices de Construção Civil (Sinapi), para as demais obras e serviços de engenharia;\n\nII - utilização de dados de pesquisa publicada em mídia especializada, de tabela de referência formalmente aprovada pelo Poder Executivo federal e de sítios eletrônicos especializados ou de domínio amplo, desde que contenham a data e a hora de acesso;\n\nIII - contratações similares feitas pela Administração Pública, em execução ou concluídas no período de 1 (um) ano anterior à data da pesquisa de preços, observado o índice de atualização de preços correspondente;\n\nIV - pesquisa na base nacional de notas fiscais eletrônicas, na forma de regulamento.\n\n§ 3º Nas contratações realizadas por Municípios, Estados e Distrito Federal, desde que não envolvam recursos da União, o valor previamente estimado da contratação, a que se refere o caput deste artigo, poderá ser definido por meio da utilização de outros sistemas de custos adotados pelo respectivo ente federativo.\n\n§ 4º Nas contratações diretas por inexigibilidade ou por dispensa, quando não for possível estimar o valor do objeto na forma estabelecida nos §§ 1º, 2º e 3º deste artigo, o contratado deverá comprovar previamente que os preços estão em conformidade com os praticados em contratações semelhantes de objetos de mesma natureza, por meio da apresentação de notas fiscais emitidas para outros contratantes no período de até 1 (um) ano anterior à data da contratação pela Administração, ou por outro meio idôneo.\n\n§ 5º No processo licitatório para contratação de obras e serviços de engenharia sob os regimes de contratação integrada ou semi-integrada, o valor estimado da contratação será calculado nos termos do\n\n§ 2º deste artigo, acrescido ou não de parcela referente à remuneração do risco, e, sempre que necessário e o anteprojeto o permitir, a estimativa de preço será baseada em orçamento sintético, balizado em sistema de custo definido no inciso I do\n\n§ 2º deste artigo, devendo a utilização de metodologia expedita ou paramétrica e de avaliação aproximada baseada em outras contratações similares ser reservada às frações do empreendimento não suficientemente detalhadas no anteprojeto.\n\n§ 6º Na hipótese do\n\n§ 5º deste artigo, será exigido dos licitantes ou contratados, no orçamento que compuser suas respectivas propostas, no mínimo, o mesmo nível de detalhamento do orçamento sintético referido no mencionado parágrafo.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },
  "24": {
    numero: "24",
    ementa: "Art. 24º desta Lei.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },
  "25": {
    numero: "25",
    ementa: "Art. 25º . O edital deverá conter o objeto da licitação e as regras relativas à convocação, ao julgamento, à habilitação, aos recursos e às penalidades da licitação, à fiscalização e à gestão do contrato, à entrega do objeto e às condições de pagamento.\n\n§ 1º Sempre que o objeto permitir, a Administração adotará minutas padronizadas de edital e de contrato com cláusulas uniformes.\n\n§ 2º Desde que, conforme demonstrado em estudo técnico preliminar, não sejam causados prejuízos à competitividade do processo licitatório e à eficiência do respectivo contrato, o edital poderá prever a utilização de mão de obra, materiais, tecnologias e matérias-primas existentes no local da execução, conservação e operação do bem, serviço ou obra.\n\n§ 3º Todos os elementos do edital, incluídos minuta de contrato, termos de referência, anteprojeto, projetos e outros anexos, deverão ser divulgados em sítio eletrônico oficial na mesma data de divulgação do edital, sem necessidade de registro ou de identificação para acesso.\n\n§ 4º Nas contratações de obras, serviços e fornecimentos de grande vulto, o edital deverá prever a obrigatoriedade de implantação de programa de integridade pelo licitante vencedor, no prazo de 6 (seis) meses, contado da celebração do contrato, conforme regulamento que disporá sobre as medidas a serem adotadas, a forma de comprovação e as penalidades pelo seu descumprimento. (Regulamento)\n\n§ 5º O edital poderá prever a responsabilidade do contratado pela:\n\nI - obtenção do licenciamento ambiental;\n\nII - realização da desapropriação autorizada pelo poder público.\n\n§ 6º Os licenciamentos ambientais de obras e serviços de engenharia licitados e contratados nos termos desta Lei terão prioridade de tramitação nos órgãos e entidades integrantes do Sistema Nacional do Meio Ambiente (Sisnama) e deverão ser orientados pelos princípios da celeridade, da cooperação, da economicidade e da eficiência.\n\n§ 7º Independentemente do prazo de duração do contrato, será obrigatória a previsão no edital de índice de reajustamento de preço, com data-base vinculada à data do orçamento estimado e com a possibilidade de ser estabelecido mais de um índice específico ou setorial, em conformidade com a realidade de mercado dos respectivos insumos.\n\n§ 8º Nas licitações de serviços contínuos, observado o interregno mínimo de 1 (um) ano, o critério de reajustamento será por:\n\nI - reajustamento em sentido estrito, quando não houver regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, mediante previsão de índices específicos ou setoriais;\n\nII - repactuação, quando houver regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, mediante demonstração analítica da variação dos custos.\n\n§ 9º O edital poderá, na forma disposta em regulamento, exigir que percentual mínimo da mão de obra responsável pela execução do objeto da contratação seja constituído por:\n\nI - mulheres vítimas de violência doméstica; (Vide Decreto nº 11.430, de 2023) Vigência\n\nII - oriundos ou egressos do sistema prisional.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },

  // SEÇÃO III - DO ANTEPROJETO E DO PROJETO (Arts. 26 a 28)
  "26": {
    numero: "26",
    ementa: "Art. 26º . No processo de licitação, poderá ser estabelecida margem de preferência para: (Regulamento)\n\nI - bens manufaturados e serviços nacionais que atendam a normas técnicas brasileiras;\n\nII - bens reciclados, recicláveis ou biodegradáveis, conforme regulamento.\n\n§ 1º A margem de preferência de que trata o caput deste artigo:\n\nI - será definida em decisão fundamentada do Poder Executivo federal, no caso do inciso I do caput deste artigo;\n\nII - poderá ser de até 10% (dez por cento) sobre o preço dos bens e serviços que não se enquadrem no disposto nos incisos I ou II do caput deste artigo;\n\nIII - poderá ser estendida a bens manufaturados e serviços originários de Estados Partes do Mercado Comum do Sul (Mercosul), desde que haja reciprocidade com o País prevista em acordo internacional aprovado pelo Congresso Nacional e ratificado pelo Presidente da República.\n\n§ 2º Para os bens manufaturados nacionais e serviços nacionais resultantes de desenvolvimento e inovação tecnológica no País, definidos conforme regulamento do Poder Executivo federal, a margem de preferência a que se refere o caput deste artigo poderá ser de até 20% (vinte por cento).\n\n§ 3º (VETADO).\n\n§ 4º (VETADO).\n\n§ 5º A margem de preferência não se aplica aos bens manufaturados nacionais e aos serviços nacionais se a capacidade de produção desses bens ou de prestação desses serviços no País for inferior:\n\nI - à quantidade a ser adquirida ou contratada; ou\n\nII - aos quantitativos fixados em razão do parcelamento do objeto, quando for o caso.\n\n§ 6º Os editais de licitação para a contratação de bens, serviços e obras poderão, mediante prévia justificativa da autoridade competente, exigir que o contratado promova, em favor de órgão ou entidade integrante da Administração Pública ou daqueles por ela indicados a partir de processo isonômico, medidas de compensação comercial, industrial ou tecnológica ou acesso a condições vantajosas de financiamento, cumulativamente ou não, na forma estabelecida pelo Poder Executivo federal.\n\n§ 7º Nas contratações destinadas à implantação, à manutenção e ao aperfeiçoamento dos sistemas de tecnologia de informação e comunicação considerados estratégicos em ato do Poder Executivo federal, a licitação poderá ser restrita a bens e serviços com tecnologia desenvolvida no País produzidos de acordo com o processo produtivo básico de que trata a Lei nº 10.176, de 11 de janeiro de 2001.",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO III",
    secao: "Anteprojeto e Projeto"
  },
  "27": {
    numero: "27",
    ementa: "Art. 27º . Será divulgada, em sítio eletrônico oficial, a cada exercício financeiro, a relação de empresas favorecidas em decorrência do disposto no",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO III"
  },
  "28": {
    numero: "28",
    ementa: "Art. 28º . São modalidades de licitação:\n\nI - pregão;\n\nII - concorrência;\n\nIII - concurso;\n\nIV - leilão;\n\nV - diálogo competitivo.\n\n§ 1º Além das modalidades referidas no caput deste artigo, a Administração pode servir-se dos procedimentos auxiliares previstos no",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO III"
  },

  // CAPÍTULO II - DAS MODALIDADES DE LICITAÇÃO (Arts. 29 a 34)
  "29": {
    numero: "29",
    ementa: "Art. 29º . A concorrência e o pregão seguem o rito procedimental comum a que se refere o",
    capitulo: "TÍTULO II - CAPÍTULO II",
    secao: "Modalidades de Licitação"
  },
  "30": {
    numero: "30",
    ementa: "Art. 30º . O concurso observará as regras e condições previstas em edital, que indicará:\n\nI - a qualificação exigida dos participantes;\n\nII - as diretrizes e formas de apresentação do trabalho;\n\nIII - as condições de realização e o prêmio ou remuneração a ser concedida ao vencedor. Parágrafo único. Nos concursos destinados à elaboração de projeto, o vencedor deverá ceder à Administração Pública, nos termos do",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "31": {
    numero: "31",
    ementa: "Art. 31º . O leilão poderá ser cometido a leiloeiro oficial ou a servidor designado pela autoridade competente da Administração, e regulamento deverá dispor sobre seus procedimentos operacionais.\n\n§ 1º Se optar pela realização de leilão por intermédio de leiloeiro oficial, a Administração deverá selecioná-lo mediante credenciamento ou licitação na modalidade pregão e adotar o critério de julgamento de maior desconto para as comissões a serem cobradas, utilizados como parâmetro máximo os percentuais definidos na lei que regula a referida profissão e observados os valores dos bens a serem leiloados.\n\n§ 2º O leilão será precedido da divulgação do edital em sítio eletrônico oficial, que conterá:\n\nI - a descrição do bem, com suas características, e, no caso de imóvel, sua situação e suas divisas, com remissão à matrícula e aos registros;\n\nII - o valor pelo qual o bem foi avaliado, o preço mínimo pelo qual poderá ser alienado, as condições de pagamento e, se for o caso, a comissão do leiloeiro designado;\n\nIII - a indicação do lugar onde estiverem os móveis, os veículos e os semoventes;\n\nIV - o sítio da internet e o período em que ocorrerá o leilão, salvo se excepcionalmente for realizado sob a forma presencial por comprovada inviabilidade técnica ou desvantagem para a Administração, hipótese em que serão indicados o local, o dia e a hora de sua realização;\n\nV - a especificação de eventuais ônus, gravames ou pendências existentes sobre os bens a serem leiloados.\n\n§ 3º Além da divulgação no sítio eletrônico oficial, o edital do leilão será afixado em local de ampla circulação de pessoas na sede da Administração e poderá, ainda, ser divulgado por outros meios necessários para ampliar a publicidade e a competitividade da licitação.\n\n§ 4º O leilão não exigirá registro cadastral prévio, não terá fase de habilitação e deverá ser homologado assim que concluída a fase de lances, superada a fase recursal e efetivado o pagamento pelo licitante vencedor, na forma definida no edital.",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "32": {
    numero: "32",
    ementa: "Art. 32º . A modalidade diálogo competitivo é restrita a contratações em que a Administração:\n\nI - vise a contratar objeto que envolva as seguintes condições:\n\na) inovação tecnológica ou técnica;\n\nb) impossibilidade de o órgão ou entidade ter sua necessidade satisfeita sem a adaptação de soluções disponíveis no mercado; e\n\nc) impossibilidade de as especificações técnicas serem definidas com precisão suficiente pela Administração;\n\nII - verifique a necessidade de definir e identificar os meios e as alternativas que possam satisfazer suas necessidades, com destaque para os seguintes aspectos:\n\na) a solução técnica mais adequada;\n\nb) os requisitos técnicos aptos a concretizar a solução já definida;\n\nc) a estrutura jurídica ou financeira do contrato;\n\nIII - (VETADO).\n\n§ 1º Na modalidade diálogo competitivo, serão observadas as seguintes disposições:\n\nI - a Administração apresentará, por ocasião da divulgação do edital em sítio eletrônico oficial, suas necessidades e as exigências já definidas e estabelecerá prazo mínimo de 25 (vinte e cinco) dias úteis para manifestação de interesse na participação da licitação;\n\nII - os critérios empregados para pré-seleção dos licitantes deverão ser previstos em edital, e serão admitidos todos os interessados que preencherem os requisitos objetivos estabelecidos;\n\nIII - a divulgação de informações de modo discriminatório que possa implicar vantagem para algum licitante será vedada;\n\nIV - a Administração não poderá revelar a outros licitantes as soluções propostas ou as informações sigilosas comunicadas por um licitante sem o seu consentimento;\n\nV - a fase de diálogo poderá ser mantida até que a Administração, em decisão fundamentada, identifique a solução ou as soluções que atendam às suas necessidades;\n\nVI - as reuniões com os licitantes pré-selecionados serão registradas em ata e gravadas mediante utilização de recursos tecnológicos de áudio e vídeo;\n\nVII - o edital poderá prever a realização de fases sucessivas, caso em que cada fase poderá restringir as soluções ou as propostas a serem discutidas;\n\nVIII - a Administração deverá, ao declarar que o diálogo foi concluído, juntar aos autos do processo licitatório os registros e as gravações da fase de diálogo, iniciar a fase competitiva com a divulgação de edital contendo a especificação da solução que atenda às suas necessidades e os critérios objetivos a serem utilizados para seleção da proposta mais vantajosa e abrir prazo, não inferior a 60 (sessenta) dias úteis, para todos os licitantes pré-selecionados na forma do inciso II deste parágrafo apresentarem suas propostas, que deverão conter os elementos necessários para a realização do projeto;\n\nIX - a Administração poderá solicitar esclarecimentos ou ajustes às propostas apresentadas, desde que não impliquem discriminação nem distorçam a concorrência entre as propostas;\n\nX - a Administração definirá a proposta vencedora de acordo com critérios divulgados no início da fase competitiva, assegurada a contratação mais vantajosa como resultado;\n\nXI - o diálogo competitivo será conduzido por comissão de contratação composta de pelo menos 3 (três) servidores efetivos ou empregados públicos pertencentes aos quadros permanentes da Administração, admitida a contratação de profissionais para assessoramento técnico da comissão;\n\nXII - (VETADO).\n\n§ 2º Os profissionais contratados para os fins do inciso XI do\n\n§ 1º deste artigo assinarão termo de confidencialidade e abster-se-ão de atividades que possam configurar conflito de interesses. Dos Critérios de Julgamento",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "33": {
    numero: "33",
    ementa: "Art. 33º . O julgamento das propostas será realizado de acordo com os seguintes critérios:\n\nI - menor preço;\n\nII - maior desconto;\n\nIII - melhor técnica ou conteúdo artístico;\n\nIV - técnica e preço;\n\nV - maior lance, no caso de leilão;\n\nVI - maior retorno econômico.",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "34": {
    numero: "34",
    ementa: "Art. 34º . O julgamento por menor preço ou maior desconto e, quando couber, por técnica e preço considerará o menor dispêndio para a Administração, atendidos os parâmetros mínimos de qualidade definidos no edital de licitação.\n\n§ 1º Os custos indiretos, relacionados com as despesas de manutenção, utilização, reposição, depreciação e impacto ambiental do objeto licitado, entre outros fatores vinculados ao seu ciclo de vida, poderão ser considerados para a definição do menor dispêndio, sempre que objetivamente mensuráveis, conforme disposto em regulamento.\n\n§ 2º O julgamento por maior desconto terá como referência o preço global fixado no edital de licitação, e o desconto será estendido aos eventuais termos aditivos.",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },

  // CAPÍTULO III - DOS CRITÉRIOS DE JULGAMENTO (Arts. 35 a 40)
  "35": {
    numero: "35",
    ementa: "Art. 35º . O julgamento por melhor técnica ou conteúdo artístico considerará exclusivamente as propostas técnicas ou artísticas apresentadas pelos licitantes, e o edital deverá definir o prêmio ou a remuneração que será atribuída aos vencedores. Parágrafo único. O critério de julgamento de que trata o caput deste artigo poderá ser utilizado para a contratação de projetos e trabalhos de natureza técnica, científica ou artística.",
    capitulo: "TÍTULO II - CAPÍTULO III",
    secao: "Critérios de Julgamento"
  },
  "36": {
    numero: "36",
    ementa: "Art. 36º . O julgamento por técnica e preço considerará a maior pontuação obtida a partir da ponderação, segundo fatores objetivos previstos no edital, das notas atribuídas aos aspectos de técnica e de preço da proposta.\n\n§ 1º O critério de julgamento de que trata o caput deste artigo será escolhido quando estudo técnico preliminar demonstrar que a avaliação e a ponderação da qualidade técnica das propostas que superarem os requisitos mínimos estabelecidos no edital forem relevantes aos fins pretendidos pela Administração nas licitações para contratação de:\n\nI - serviços técnicos especializados de natureza predominantemente intelectual, caso em que o critério de julgamento de técnica e preço deverá ser preferencialmente empregado;\n\nII - serviços majoritariamente dependentes de tecnologia sofisticada e de domínio restrito, conforme atestado por autoridades técnicas de reconhecida qualificação;\n\nIII - bens e serviços especiais de tecnologia da informação e de comunicação;\n\nIV - obras e serviços especiais de engenharia;\n\nV - objetos que admitam soluções específicas e alternativas e variações de execução, com repercussões significativas e concretamente mensuráveis sobre sua qualidade, produtividade, rendimento e durabilidade, quando essas soluções e variações puderem ser adotadas à livre escolha dos licitantes, conforme critérios objetivamente definidos no edital de licitação.\n\n§ 2º No julgamento por técnica e preço, deverão ser avaliadas e ponderadas as propostas técnicas e, em seguida, as propostas de preço apresentadas pelos licitantes, na proporção máxima de 70% (setenta por cento) de valoração para a proposta técnica.\n\n§ 3º O desempenho pretérito na execução de contratos com a Administração Pública deverá ser considerado na pontuação técnica, observado o disposto nos §§ 3º e 4º do",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "37": {
    numero: "37",
    ementa: "Art. 37º da Constituição Federal.",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "38": {
    numero: "38",
    ementa: "Art. 38º . No julgamento por melhor técnica ou por técnica e preço, a obtenção de pontuação devido à capacitação técnico-profissional exigirá que a execução do respectivo contrato tenha participação direta e pessoal do profissional correspondente.",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "39": {
    numero: "39",
    ementa: "Art. 39º . O julgamento por maior retorno econômico, utilizado exclusivamente para a celebração de contrato de eficiência, considerará a maior economia para a Administração, e a remuneração deverá ser fixada em percentual que incidirá de forma proporcional à economia efetivamente obtida na execução do contrato.\n\n§ 1º Nas licitações que adotarem o critério de julgamento de que trata o caput deste artigo, os licitantes apresentarão:\n\nI - proposta de trabalho, que deverá contemplar:\n\na) as obras, os serviços ou os bens, com os respectivos prazos de realização ou fornecimento;\n\nb) a economia que se estima gerar, expressa em unidade de medida associada à obra, ao bem ou ao serviço e em unidade monetária;\n\nII - proposta de preço, que corresponderá a percentual sobre a economia que se estima gerar durante determinado período, expressa em unidade monetária.\n\n§ 2º O edital de licitação deverá prever parâmetros objetivos de mensuração da economia gerada com a execução do contrato, que servirá de base de cálculo para a remuneração devida ao contratado.\n\n§ 3º Para efeito de julgamento da proposta, o retorno econômico será o resultado da economia que se estima gerar com a execução da proposta de trabalho, deduzida a proposta de preço.\n\n§ 4º Nos casos em que não for gerada a economia prevista no contrato de eficiência:\n\nI - a diferença entre a economia contratada e a efetivamente obtida será descontada da remuneração do contratado;\n\nII - se a diferença entre a economia contratada e a efetivamente obtida for superior ao limite máximo estabelecido no contrato, o contratado sujeitar-se-á, ainda, a outras sanções cabíveis. Disposições Setoriais Das Compras",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "40": {
    numero: "40",
    ementa: "Art. 40º . O planejamento de compras deverá considerar a expectativa de consumo anual e observar o seguinte:\n\nI - condições de aquisição e pagamento semelhantes às do setor privado;\n\nII - processamento por meio de sistema de registro de preços, quando pertinente;\n\nIII - determinação de unidades e quantidades a serem adquiridas em função de consumo e utilização prováveis, cuja estimativa será obtida, sempre que possível, mediante adequadas técnicas quantitativas, admitido o fornecimento contínuo;\n\nIV - condições de guarda e armazenamento que não permitam a deterioração do material;\n\nV - atendimento aos princípios:\n\na) da padronização, considerada a compatibilidade de especificações estéticas, técnicas ou de desempenho;\n\nb) do parcelamento, quando for tecnicamente viável e economicamente vantajoso;\n\nc) da responsabilidade fiscal, mediante a comparação da despesa estimada com a prevista no orçamento.\n\n§ 1º O termo de referência deverá conter os elementos previstos no inciso XXIII do caput do",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },

  // CAPÍTULO IV - DO PROCEDIMENTO DA LICITAÇÃO (Arts. 41 a 71)
  "41": {
    numero: "41",
    ementa: "Art. 41º . No caso de licitação que envolva o fornecimento de bens, a Administração poderá excepcionalmente:\n\nI - indicar uma ou mais marcas ou modelos, desde que formalmente justificado, nas seguintes hipóteses:\n\na) em decorrência da necessidade de padronização do objeto;\n\nb) em decorrência da necessidade de manter a compatibilidade com plataformas e padrões já adotados pela Administração;\n\nc) quando determinada marca ou modelo comercializados por mais de um fornecedor forem os únicos capazes de atender às necessidades do contratante;\n\nd) quando a descrição do objeto a ser licitado puder ser mais bem compreendida pela identificação de determinada marca ou determinado modelo aptos a servir apenas como referência;\n\nII - exigir amostra ou prova de conceito do bem no procedimento de pré-qualificação permanente, na fase de julgamento das propostas ou de lances, ou no período de vigência do contrato ou da ata de registro de preços, desde que previsto no edital da licitação e justificada a necessidade de sua apresentação;\n\nIII - vedar a contratação de marca ou produto, quando, mediante processo administrativo, restar comprovado que produtos adquiridos e utilizados anteriormente pela Administração não atendem a requisitos indispensáveis ao pleno adimplemento da obrigação contratual;\n\nIV - solicitar, motivadamente, carta de solidariedade emitida pelo fabricante, que assegure a execução do contrato, no caso de licitante revendedor ou distribuidor. Parágrafo único. A exigência prevista no inciso II do caput deste artigo restringir-se-á ao licitante provisoriamente vencedor quando realizada na fase de julgamento das propostas ou de lances.",
    capitulo: "TÍTULO II - CAPÍTULO IV",
    secao: "Procedimento da Licitação"
  },
  "42": {
    numero: "42",
    ementa: "Art. 42º . A prova de qualidade de produto apresentado pelos proponentes como similar ao das marcas eventualmente indicadas no edital será admitida por qualquer um dos seguintes meios:\n\nI - comprovação de que o produto está de acordo com as normas técnicas determinadas pelos órgãos oficiais competentes, pela Associação Brasileira de Normas Técnicas (ABNT) ou por outra entidade credenciada pelo Inmetro;\n\nII - declaração de atendimento satisfatório emitida por outro órgão ou entidade de nível federativo equivalente ou superior que tenha adquirido o produto;\n\nIII - certificação, certificado, laudo laboratorial ou documento similar que possibilite a aferição da qualidade e da conformidade do produto ou do processo de fabricação, inclusive sob o aspecto ambiental, emitido por instituição oficial competente ou por entidade credenciada.\n\n§ 1º O edital poderá exigir, como condição de aceitabilidade da proposta, certificação de qualidade do produto por instituição credenciada pelo Conselho Nacional de Metrologia, Normalização e Qualidade Industrial (Conmetro).\n\n§ 2º A Administração poderá, nos termos do edital de licitação, oferecer protótipo do objeto pretendido e exigir, na fase de julgamento das propostas, amostras do licitante provisoriamente vencedor, para atender a diligência ou, após o julgamento, como condição para firmar contrato.\n\n§ 3º No interesse da Administração, as amostras a que se refere o\n\n§ 2º deste artigo poderão ser examinadas por instituição com reputação ético-profissional na especialidade do objeto, previamente indicada no edital.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "43": {
    numero: "43",
    ementa: "Art. 43º . O processo de padronização deverá conter:\n\nI - parecer técnico sobre o produto, considerados especificações técnicas e estéticas, desempenho, análise de contratações anteriores, custo e condições de manutenção e garantia;\n\nII - despacho motivado da autoridade superior, com a adoção do padrão;\n\nIII - síntese da justificativa e descrição sucinta do padrão definido, divulgadas em sítio eletrônico oficial.\n\n§ 1º É permitida a padronização com base em processo de outro órgão ou entidade de nível federativo igual ou superior ao do órgão adquirente, devendo o ato que decidir pela adesão a outra padronização ser devidamente motivado, com indicação da necessidade da Administração e dos riscos decorrentes dessa decisão, e divulgado em sítio eletrônico oficial.\n\n§ 2º As contratações de soluções baseadas em software de uso disseminado serão disciplinadas em regulamento que defina processo de gestão estratégica das contratações desse tipo de solução.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "44": {
    numero: "44",
    ementa: "Art. 44º . Quando houver a possibilidade de compra ou de locação de bens, o estudo técnico preliminar deverá considerar os custos e os benefícios de cada opção, com indicação da alternativa mais vantajosa. Das Obras e Serviços de Engenharia",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "45": {
    numero: "45",
    ementa: "Art. 45º . As licitações de obras e serviços de engenharia devem respeitar, especialmente, as normas relativas a:\n\nI - disposição final ambientalmente adequada dos resíduos sólidos gerados pelas obras contratadas;\n\nII - mitigação por condicionantes e compensação ambiental, que serão definidas no procedimento de licenciamento ambiental;\n\nIII - utilização de produtos, de equipamentos e de serviços que, comprovadamente, favoreçam a redução do consumo de energia e de recursos naturais;\n\nIV - avaliação de impacto de vizinhança, na forma da legislação urbanística;\n\nV - proteção do patrimônio histórico, cultural, arqueológico e imaterial, inclusive por meio da avaliação do impacto direto ou indireto causado pelas obras contratadas;\n\nVI - acessibilidade para pessoas com deficiência ou com mobilidade reduzida.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "46": {
    numero: "46",
    ementa: "Art. 46º desta Lei; XXVI - projeto executivo: conjunto de elementos necessários e suficientes à execução completa da obra, com o detalhamento das soluções previstas no projeto básico, a identificação de serviços, de materiais e de equipamentos a serem incorporados à obra, bem como suas especificações técnicas, de acordo com as normas técnicas pertinentes; XXVII - matriz de riscos: cláusula contratual definidora de riscos e de responsabilidades entre as partes e caracterizadora do equilíbrio econômico-financeiro inicial do contrato, em termos de ônus financeiro decorrente de eventos supervenientes à contratação, contendo, no mínimo, as seguintes informações:\n\na) listagem de possíveis eventos supervenientes à assinatura do contrato que possam causar impacto em seu equilíbrio econômico-financeiro e previsão de eventual necessidade de prolação de termo aditivo por ocasião de sua ocorrência;\n\nb) no caso de obrigações de resultado, estabelecimento das frações do objeto com relação às quais haverá liberdade para os contratados inovarem em soluções metodológicas ou tecnológicas, em termos de modificação das soluções previamente delineadas no anteprojeto ou no projeto básico;\n\nc) no caso de obrigações de meio, estabelecimento preciso das frações do objeto com relação às quais não haverá liberdade para os contratados inovarem em soluções metodológicas ou tecnológicas, devendo haver obrigação de aderência entre a execução e a solução predefinida no anteprojeto ou no projeto básico, consideradas as características do regime de execução no caso de obras e serviços de engenharia; XXVIII - empreitada por preço unitário: contratação da execução da obra ou do serviço por preço certo de unidades determinadas; XXIX - empreitada por preço global: contratação da execução da obra ou do serviço por preço certo e total; XXX - empreitada integral: contratação de empreendimento em sua integralidade, compreendida a totalidade das etapas de obras, serviços e instalações necessárias, sob inteira responsabilidade do contratado até sua entrega ao contratante em condições de entrada em operação, com características adequadas às finalidades para as quais foi contratado e atendidos os requisitos técnicos e legais para sua utilização com segurança estrutural e operacional; XXXI - contratação por tarefa: regime de contratação de mão de obra para pequenos trabalhos por preço certo, com ou sem fornecimento de materiais; XXXII - contratação integrada: regime de contratação de obras e serviços de engenharia em que o contratado é responsável por elaborar e desenvolver os projetos básico e executivo, executar obras e serviços de engenharia, fornecer bens ou prestar serviços especiais e realizar montagem, teste, pré-operação e as demais operações necessárias e suficientes para a entrega final do objeto; XXXIII - contratação semi-integrada: regime de contratação de obras e serviços de engenharia em que o contratado é responsável por elaborar e desenvolver o projeto executivo, executar obras e serviços de engenharia, fornecer bens ou prestar serviços especiais e realizar montagem, teste, pré-operação e as demais operações necessárias e suficientes para a entrega final do objeto; XXXIV - fornecimento e prestação de serviço associado: regime de contratação em que, além do fornecimento do objeto, o contratado responsabiliza-se por sua operação, manutenção ou ambas, por tempo determinado; XXXV - licitação internacional: licitação processada em território nacional na qual é admitida a participação de licitantes estrangeiros, com a possibilidade de cotação de preços em moeda estrangeira, ou licitação na qual o objeto contratual pode ou deve ser executado no todo ou em parte em território estrangeiro; XXXVI - serviço nacional: serviço prestado em território nacional, nas condições estabelecidas pelo Poder Executivo federal; XXXVII - produto manufaturado nacional: produto manufaturado produzido no território nacional de acordo com o processo produtivo básico ou com as regras de origem estabelecidas pelo Poder Executivo federal; XXXVIII - concorrência: modalidade de licitação para contratação de bens e serviços especiais e de obras e serviços comuns e especiais de engenharia, cujo critério de julgamento poderá ser:\n\na) menor preço;\n\nb) melhor técnica ou conteúdo artístico;\n\nc) técnica e preço;\n\nd) maior retorno econômico;\n\ne) maior desconto; XXXIX - concurso: modalidade de licitação para escolha de trabalho técnico, científico ou artístico, cujo critério de julgamento será o de melhor técnica ou conteúdo artístico, e para concessão de prêmio ou remuneração ao vencedor; XL - leilão: modalidade de licitação para alienação de bens imóveis ou de bens móveis inservíveis ou legalmente apreendidos a quem oferecer o maior lance; XLI - pregão: modalidade de licitação obrigatória para aquisição de bens e serviços comuns, cujo critério de julgamento poderá ser o de menor preço ou o de maior desconto; XLII - diálogo competitivo: modalidade de licitação para contratação de obras, serviços e compras em que a Administração Pública realiza diálogos com licitantes previamente selecionados mediante critérios objetivos, com o intuito de desenvolver uma ou mais alternativas capazes de atender às suas necessidades, devendo os licitantes apresentar proposta final após o encerramento dos diálogos; XLIII - credenciamento: processo administrativo de chamamento público em que a Administração Pública convoca interessados em prestar serviços ou fornecer bens para que, preenchidos os requisitos necessários, se credenciem no órgão ou na entidade para executar o objeto quando convocados; XLIV - pré-qualificação: procedimento seletivo prévio à licitação, convocado por meio de edital, destinado à análise das condições de habilitação, total ou parcial, dos interessados ou do objeto; XLV - sistema de registro de preços: conjunto de procedimentos para realização, mediante contratação direta ou licitação nas modalidades pregão ou concorrência, de registro formal de preços relativos a prestação de serviços, a obras e a aquisição e locação de bens para contratações futuras; XLVI - ata de registro de preços: documento vinculativo e obrigacional, com característica de compromisso para futura contratação, no qual são registrados o objeto, os preços, os fornecedores, os órgãos participantes e as condições a serem praticadas, conforme as disposições contidas no edital da licitação, no aviso ou instrumento de contratação direta e nas propostas apresentadas; XLVII - órgão ou entidade gerenciadora: órgão ou entidade da Administração Pública responsável pela condução do conjunto de procedimentos para registro de preços e pelo gerenciamento da ata de registro de preços dele decorrente; XLVIII - órgão ou entidade participante: órgão ou entidade da Administração Pública que participa dos procedimentos iniciais da contratação para registro de preços e integra a ata de registro de preços; XLIX - órgão ou entidade não participante: órgão ou entidade da Administração Pública que não participa dos procedimentos iniciais da licitação para registro de preços e não integra a ata de registro de preços; L - comissão de contratação: conjunto de agentes públicos indicados pela Administração, em caráter permanente ou especial, com a função de receber, examinar e julgar documentos relativos às licitações e aos procedimentos auxiliares; LI - catálogo eletrônico de padronização de compras, serviços e obras: sistema informatizado, de gerenciamento centralizado e com indicação de preços, destinado a permitir a padronização de itens a serem adquiridos pela Administração Pública e que estarão disponíveis para a licitação; LII - sítio eletrônico oficial: sítio da internet, certificado digitalmente por autoridade certificadora, no qual o ente federativo divulga de forma centralizada as informações e os serviços de governo digital dos seus órgãos e entidades; LIII - contrato de eficiência: contrato cujo objeto é a prestação de serviços, que pode incluir a realização de obras e o fornecimento de bens, com o objetivo de proporcionar economia ao contratante, na forma de redução de despesas correntes, remunerado o contratado com base em percentual da economia gerada; LIV - seguro-garantia: seguro que garante o fiel cumprimento das obrigações assumidas pelo contratado; LV - produtos para pesquisa e desenvolvimento: bens, insumos, serviços e obras necessários para atividade de pesquisa científica e tecnológica, desenvolvimento de tecnologia ou inovação tecnológica, discriminados em projeto de pesquisa; LVI - sobrepreço: preço orçado para licitação ou contratado em valor expressivamente superior aos preços referenciais de mercado, seja de apenas 1 (um) item, se a licitação ou a contratação for por preços unitários de serviço, seja do valor global do objeto, se a licitação ou a contratação for por tarefa, empreitada por preço global ou empreitada integral, semi-integrada ou integrada; LVII - superfaturamento: dano provocado ao patrimônio da Administração, caracterizado, entre outras situações, por:\n\na) medição de quantidades superiores às efetivamente executadas ou fornecidas;\n\nb) deficiência na execução de obras e de serviços de engenharia que resulte em diminuição da sua qualidade, vida útil ou segurança;\n\nc) alterações no orçamento de obras e de serviços de engenharia que causem desequilíbrio econômico-financeiro do contrato em favor do contratado;\n\nd) outras alterações de cláusulas financeiras que gerem recebimentos contratuais antecipados, distorção do cronograma físico-financeiro, prorrogação injustificada do prazo contratual com custos adicionais para a Administração ou reajuste irregular de preços; LVIII - reajustamento em sentido estrito: forma de manutenção do equilíbrio econômico-financeiro de contrato consistente na aplicação do índice de correção monetária previsto no contrato, que deve retratar a variação efetiva do custo de produção, admitida a adoção de índices específicos ou setoriais; LIX - repactuação: forma de manutenção do equilíbrio econômico-financeiro de contrato utilizada para serviços contínuos com regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, por meio da análise da variação dos custos contratuais, devendo estar prevista no edital com data vinculada à apresentação das propostas, para os custos decorrentes do mercado, e com data vinculada ao acordo, à convenção coletiva ou ao dissídio coletivo ao qual o orçamento esteja vinculado, para os custos decorrentes da mão de obra; LX - agente de contratação: pessoa designada pela autoridade competente, entre servidores efetivos ou empregados públicos dos quadros permanentes da Administração Pública, para tomar decisões, acompanhar o trâmite da licitação, dar impulso ao procedimento licitatório e executar quaisquer outras atividades necessárias ao bom andamento do certame até a homologação. DOS AGENTES PÚBLICOS",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "47": {
    numero: "47",
    ementa: "Art. 47º . As licitações de serviços atenderão aos princípios:\n\nI - da padronização, considerada a compatibilidade de especificações estéticas, técnicas ou de desempenho;\n\nII - do parcelamento, quando for tecnicamente viável e economicamente vantajoso.\n\n§ 1º Na aplicação do princípio do parcelamento deverão ser considerados:\n\nI - a responsabilidade técnica;\n\nII - o custo para a Administração de vários contratos frente às vantagens da redução de custos, com divisão do objeto em itens;\n\nIII - o dever de buscar a ampliação da competição e de evitar a concentração de mercado.\n\n§ 2º Na licitação de serviços de manutenção e assistência técnica, o edital deverá definir o local de realização dos serviços, admitida a exigência de deslocamento de técnico ao local da repartição ou a exigência de que o contratado tenha unidade de prestação de serviços em distância compatível com as necessidades da Administração.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "48": {
    numero: "48",
    ementa: "Art. 48º . Poderão ser objeto de execução por terceiros as atividades materiais acessórias, instrumentais ou complementares aos assuntos que constituam área de competência legal do órgão ou da entidade, vedado à Administração ou a seus agentes, na contratação do serviço terceirizado:\n\nI - indicar pessoas expressamente nominadas para executar direta ou indiretamente o objeto contratado;\n\nII - fixar salário inferior ao definido em lei ou em ato normativo a ser pago pelo contratado;\n\nIII - estabelecer vínculo de subordinação com funcionário de empresa prestadora de serviço terceirizado;\n\nIV - definir forma de pagamento mediante exclusivo reembolso dos salários pagos;\n\nV - demandar a funcionário de empresa prestadora de serviço terceirizado a execução de tarefas fora do escopo do objeto da contratação;\n\nVI - prever em edital exigências que constituam intervenção indevida da Administração na gestão interna do contratado. Parágrafo único. Durante a vigência do contrato, é vedado ao contratado contratar cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, de dirigente do órgão ou entidade contratante ou de agente público que desempenhe função na licitação ou atue na fiscalização ou na gestão do contrato, devendo essa proibição constar expressamente do edital de licitação.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "49": {
    numero: "49",
    ementa: "Art. 49º . A Administração poderá, mediante justificativa expressa, contratar mais de uma empresa ou instituição para executar o mesmo serviço, desde que essa contratação não implique perda de economia de escala, quando:\n\nI - o objeto da contratação puder ser executado de forma concorrente e simultânea por mais de um contratado; e\n\nII - a múltipla execução for conveniente para atender à Administração. Parágrafo único. Na hipótese prevista no caput deste artigo, a Administração deverá manter o controle individualizado da execução do objeto contratual relativamente a cada um dos contratados.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "50": {
    numero: "50",
    ementa: "Art. 50º . Nas contratações de serviços com regime de dedicação exclusiva de mão de obra, o contratado deverá apresentar, quando solicitado pela Administração, sob pena de multa, comprovação do cumprimento das obrigações trabalhistas e com o Fundo de Garantia do Tempo de Serviço (FGTS) em relação aos empregados diretamente envolvidos na execução do contrato, em especial quanto ao:\n\nI - registro de ponto;\n\nII - recibo de pagamento de salários, adicionais, horas extras, repouso semanal remunerado e décimo terceiro salário;\n\nIII - comprovante de depósito do FGTS;\n\nIV - recibo de concessão e pagamento de férias e do respectivo adicional;\n\nV - recibo de quitação de obrigações trabalhistas e previdenciárias dos empregados dispensados até a data da extinção do contrato;\n\nVI - recibo de pagamento de vale-transporte e vale-alimentação, na forma prevista em norma coletiva. Da Locação de Imóveis",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "51": {
    numero: "51",
    ementa: "Art. 51º . Ressalvado o disposto no inciso V do caput do",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "52": {
    numero: "52",
    ementa: "Art. 52º desta Lei;\n\nIII - o desatendimento de exigências meramente formais que não comprometam a aferição da qualificação do licitante ou a compreensão do conteúdo de sua proposta não importará seu afastamento da licitação ou a invalidação do processo;\n\nIV - a prova de autenticidade de cópia de documento público ou particular poderá ser feita perante agente da Administração, mediante apresentação de original ou de declaração de autenticidade por advogado, sob sua responsabilidade pessoal;\n\nV - o reconhecimento de firma somente será exigido quando houver dúvida de autenticidade, salvo imposição legal;\n\nVI - os atos serão preferencialmente digitais, de forma a permitir que sejam produzidos, comunicados, armazenados e validados por meio eletrônico;\n\nVII - a partir de documentos de formalização de demandas, os órgãos responsáveis pelo planejamento de cada ente federativo poderão, na forma de regulamento, elaborar plano de contratações anual, com o objetivo de racionalizar as contratações dos órgãos e entidades sob sua competência, garantir o alinhamento com o seu planejamento estratégico e subsidiar a elaboração das respectivas leis orçamentárias. (Regulamento)\n\n§ 1º O plano de contratações anual de que trata o inciso VII do caput deste artigo deverá ser divulgado e mantido à disposição do público em sítio eletrônico oficial e será observado pelo ente federativo na realização de licitações e na execução dos contratos.\n\n§ 2º É permitida a identificação e assinatura digital por pessoa física ou jurídica em meio eletrônico, mediante certificado digital emitido em âmbito da Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil).",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "53": {
    numero: "53",
    ementa: "Art. 53º desta Lei, a advocacia pública promoverá, a critério do agente público, sua representação judicial ou extrajudicial.\n\n§ 1º Não se aplica o disposto no caput deste artigo quando:\n\nI - (VETADO);\n\nII - provas da prática de atos ilícitos dolosos constarem nos autos do processo administrativo ou judicial.\n\n§ 2º Aplica-se o disposto no caput deste artigo inclusive na hipótese de o agente público não mais ocupar o cargo, emprego ou função em que foi praticado o ato questionado. DAS LICITAÇÕES DO PROCESSO LICITATÓRIO",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "54": {
    numero: "54",
    ementa: "Art. 54º .\n\n§ 4º Na forma deste artigo, o órgão de assessoramento jurídico da Administração também realizará controle prévio de legalidade de contratações diretas, acordos, termos de cooperação, convênios, ajustes, adesões a atas de registro de preços, outros instrumentos congêneres e de seus termos aditivos.\n\n§ 5º É dispensável a análise jurídica nas hipóteses previamente definidas em ato da autoridade jurídica máxima competente, que deverá considerar o baixo valor, a baixa complexidade da contratação, a entrega imediata do bem ou a utilização de minutas de editais e instrumentos de contrato, convênio ou outros ajustes previamente padronizados pelo órgão de assessoramento jurídico.\n\n§ 6º (VETADO).",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "55": {
    numero: "55",
    ementa: "Art. 55º . Os prazos mínimos para apresentação de propostas e lances, contados a partir da data de divulgação do edital de licitação, são de:\n\nI - para aquisição de bens:\n\na) 8 (oito) dias úteis, quando adotados os critérios de julgamento de menor preço ou de maior desconto;\n\nb) 15 (quinze) dias úteis, nas hipóteses não abrangidas pela alínea a deste inciso;\n\nII - no caso de serviços e obras:\n\na) 10 (dez) dias úteis, quando adotados os critérios de julgamento de menor preço ou de maior desconto, no caso de serviços comuns e de obras e serviços comuns de engenharia;\n\nb) 25 (vinte e cinco) dias úteis, quando adotados os critérios de julgamento de menor preço ou de maior desconto, no caso de serviços especiais e de obras e serviços especiais de engenharia;\n\nc) 60 (sessenta) dias úteis, quando o regime de execução for de contratação integrada;\n\nd) 35 (trinta e cinco) dias úteis, quando o regime de execução for o de contratação semi-integrada ou nas hipóteses não abrangidas pelas alíneas a, b e c deste inciso;\n\nIII - para licitação em que se adote o critério de julgamento de maior lance, 15 (quinze) dias úteis;\n\nIV - para licitação em que se adote o critério de julgamento de técnica e preço ou de melhor técnica ou conteúdo artístico, 35 (trinta e cinco) dias úteis. (Regulamento)\n\n§ 1º Eventuais modificações no edital implicarão nova divulgação na mesma forma de sua divulgação inicial, além do cumprimento dos mesmos prazos dos atos e procedimentos originais, exceto quando a alteração não comprometer a formulação das propostas.\n\n§ 2º Os prazos previstos neste artigo poderão, mediante decisão fundamentada, ser reduzidos até a metade nas licitações realizadas pelo Ministério da Saúde, no âmbito do Sistema Único de Saúde (SUS).",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "56": {
    numero: "56",
    ementa: "Art. 56º . O modo de disputa poderá ser, isolada ou conjuntamente:\n\nI - aberto, hipótese em que os licitantes apresentarão suas propostas por meio de lances públicos e sucessivos, crescentes ou decrescentes;\n\nII - fechado, hipótese em que as propostas permanecerão em sigilo até a data e hora designadas para sua divulgação.\n\n§ 1º A utilização isolada do modo de disputa fechado será vedada quando adotados os critérios de julgamento de menor preço ou de maior desconto.\n\n§ 2º A utilização do modo de disputa aberto será vedada quando adotado o critério de julgamento de técnica e preço.\n\n§ 3º Serão considerados intermediários os lances:\n\nI - iguais ou inferiores ao maior já ofertado, quando adotado o critério de julgamento de maior lance;\n\nII - iguais ou superiores ao menor já ofertado, quando adotados os demais critérios de julgamento.\n\n§ 4º Após a definição da melhor proposta, se a diferença em relação à proposta classificada em segundo lugar for de pelo menos 5% (cinco por cento), a Administração poderá admitir o reinício da disputa aberta, nos termos estabelecidos no instrumento convocatório, para a definição das demais colocações.\n\n§ 5º Nas licitações de obras ou serviços de engenharia, após o julgamento, o licitante vencedor deverá reelaborar e apresentar à Administração, por meio eletrônico, as planilhas com indicação dos quantitativos e dos custos unitários, bem como com detalhamento das Bonificações e Despesas Indiretas (BDI) e dos Encargos Sociais (ES), com os respectivos valores adequados ao valor final da proposta vencedora, admitida a utilização dos preços unitários, no caso de empreitada por preço global, empreitada integral, contratação semi-integrada e contratação integrada, exclusivamente para eventuais adequações indispensáveis no cronograma físico-financeiro e para balizar excepcional aditamento posterior do contrato.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "57": {
    numero: "57",
    ementa: "Art. 57º . O edital de licitação poderá estabelecer intervalo mínimo de diferença de valores entre os lances, que incidirá tanto em relação aos lances intermediários quanto em relação à proposta que cobrir a melhor oferta.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "58": {
    numero: "58",
    ementa: "Art. 58º . Poderá ser exigida, no momento da apresentação da proposta, a comprovação do recolhimento de quantia a título de garantia de proposta, como requisito de pré-habilitação.\n\n§ 1º A garantia de proposta não poderá ser superior a 1% (um por cento) do valor estimado para a contratação.\n\n§ 2º A garantia de proposta será devolvida aos licitantes no prazo de 10 (dez) dias úteis, contado da assinatura do contrato ou da data em que for declarada fracassada a licitação.\n\n§ 3º Implicará execução do valor integral da garantia de proposta a recusa em assinar o contrato ou a não apresentação dos documentos para a contratação.\n\n§ 4º A garantia de proposta poderá ser prestada nas modalidades de que trata o\n\n§ 1º do",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "59": {
    numero: "59",
    ementa: "Art. 59º . Serão desclassificadas as propostas que:\n\nI - contiverem vícios insanáveis;\n\nII - não obedecerem às especificações técnicas pormenorizadas no edital;\n\nIII - apresentarem preços inexequíveis ou permanecerem acima do orçamento estimado para a contratação;\n\nIV - não tiverem sua exequibilidade demonstrada, quando exigido pela Administração;\n\nV - apresentarem desconformidade com quaisquer outras exigências do edital, desde que insanável.\n\n§ 1º A verificação da conformidade das propostas poderá ser feita exclusivamente em relação à proposta mais bem classificada.\n\n§ 2º A Administração poderá realizar diligências para aferir a exequibilidade das propostas ou exigir dos licitantes que ela seja demonstrada, conforme disposto no inciso IV do caput deste artigo.\n\n§ 3º No caso de obras e serviços de engenharia e arquitetura, para efeito de avaliação da exequibilidade e de sobrepreço, serão considerados o preço global, os quantitativos e os preços unitários tidos como relevantes, observado o critério de aceitabilidade de preços unitário e global a ser fixado no edital, conforme as especificidades do mercado correspondente.\n\n§ 4º No caso de obras e serviços de engenharia, serão consideradas inexequíveis as propostas cujos valores forem inferiores a 75% (setenta e cinco por cento) do valor orçado pela Administração.\n\n§ 5º Nas contratações de obras e serviços de engenharia, será exigida garantia adicional do licitante vencedor cuja proposta for inferior a 85% (oitenta e cinco por cento) do valor orçado pela Administração, equivalente à diferença entre este último e o valor da proposta, sem prejuízo das demais garantias exigíveis de acordo com esta Lei.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "60": {
    numero: "60",
    ementa: "Art. 60º . Em caso de empate entre duas ou mais propostas, serão utilizados os seguintes critérios de desempate, nesta ordem:\n\nI - disputa final, hipótese em que os licitantes empatados poderão apresentar nova proposta em ato contínuo à classificação;\n\nII - avaliação do desempenho contratual prévio dos licitantes, para a qual deverão preferencialmente ser utilizados registros cadastrais para efeito de atesto de cumprimento de obrigações previstos nesta Lei;\n\nIII - desenvolvimento pelo licitante de ações de equidade entre homens e mulheres no ambiente de trabalho, conforme regulamento; (Vide Decreto nº 11.430, de 2023) Vigência\n\nIV - desenvolvimento pelo licitante de programa de integridade, conforme orientações dos órgãos de controle.\n\n§ 1º Em igualdade de condições, se não houver desempate, será assegurada preferência, sucessivamente, aos bens e serviços produzidos ou prestados por:\n\nI - empresas estabelecidas no território do Estado ou do Distrito Federal do órgão ou entidade da Administração Pública estadual ou distrital licitante ou, no caso de licitação realizada por órgão ou entidade de Município, no território do Estado em que este se localize;\n\nII - empresas brasileiras;\n\nIII - empresas que invistam em pesquisa e no desenvolvimento de tecnologia no País;\n\nIV - empresas que comprovem a prática de mitigação, nos termos da Lei nº 12.187, de 29 de dezembro de 2009.\n\n§ 2º As regras previstas no caput deste artigo não prejudicarão a aplicação do disposto no",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "61": {
    numero: "61",
    ementa: "Art. 61º . Definido o resultado do julgamento, a Administração poderá negociar condições mais vantajosas com o primeiro colocado.\n\n§ 1º A negociação poderá ser feita com os demais licitantes, segundo a ordem de classificação inicialmente estabelecida, quando o primeiro colocado, mesmo após a negociação, for desclassificado em razão de sua proposta permanecer acima do preço máximo definido pela Administração.\n\n§ 2º A negociação será conduzida por agente de contratação ou comissão de contratação, na forma de regulamento, e, depois de concluída, terá seu resultado divulgado a todos os licitantes e anexado aos autos do processo licitatório. DA HABILITAÇÃO",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "62": {
    numero: "62",
    ementa: "Art. 62º . A habilitação é a fase da licitação em que se verifica o conjunto de informações e documentos necessários e suficientes para demonstrar a capacidade do licitante de realizar o objeto da licitação, dividindo-se em:\n\nI - jurídica;\n\nII - técnica;\n\nIII - fiscal, social e trabalhista;\n\nIV - econômico-financeira.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "63": {
    numero: "63",
    ementa: "Art. 63º . Na fase de habilitação das licitações serão observadas as seguintes disposições:\n\nI - poderá ser exigida dos licitantes a declaração de que atendem aos requisitos de habilitação, e o declarante responderá pela veracidade das informações prestadas, na forma da lei;\n\nII - será exigida a apresentação dos documentos de habilitação apenas pelo licitante vencedor, exceto quando a fase de habilitação anteceder a de julgamento;\n\nIII - serão exigidos os documentos relativos à regularidade fiscal, em qualquer caso, somente em momento posterior ao julgamento das propostas, e apenas do licitante mais bem classificado;\n\nIV - será exigida do licitante declaração de que cumpre as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas.\n\n§ 1º Constará do edital de licitação cláusula que exija dos licitantes, sob pena de desclassificação, declaração de que suas propostas econômicas compreendem a integralidade dos custos para atendimento dos direitos trabalhistas assegurados na Constituição Federal, nas leis trabalhistas, nas normas infralegais, nas convenções coletivas de trabalho e nos termos de ajustamento de conduta vigentes na data de entrega das propostas.\n\n§ 2º Quando a avaliação prévia do local de execução for imprescindível para o conhecimento pleno das condições e peculiaridades do objeto a ser contratado, o edital de licitação poderá prever, sob pena de inabilitação, a necessidade de o licitante atestar que conhece o local e as condições de realização da obra ou serviço, assegurado a ele o direito de realização de vistoria prévia.\n\n§ 3º Para os fins previstos no\n\n§ 2º deste artigo, o edital de licitação sempre deverá prever a possibilidade de substituição da vistoria por declaração formal assinada pelo responsável técnico do licitante acerca do conhecimento pleno das condições e peculiaridades da contratação.\n\n§ 4º Para os fins previstos no\n\n§ 2º deste artigo, se os licitantes optarem por realizar vistoria prévia, a Administração deverá disponibilizar data e horário diferentes para os eventuais interessados.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "64": {
    numero: "64",
    ementa: "Art. 64º . Após a entrega dos documentos para habilitação, não será permitida a substituição ou a apresentação de novos documentos, salvo em sede de diligência, para:\n\nI - complementação de informações acerca dos documentos já apresentados pelos licitantes e desde que necessária para apurar fatos existentes à época da abertura do certame;\n\nII - atualização de documentos cuja validade tenha expirado após a data de recebimento das propostas.\n\n§ 1º Na análise dos documentos de habilitação, a comissão de licitação poderá sanar erros ou falhas que não alterem a substância dos documentos e sua validade jurídica, mediante despacho fundamentado registrado e acessível a todos, atribuindo-lhes eficácia para fins de habilitação e classificação.\n\n§ 2º Quando a fase de habilitação anteceder a de julgamento e já tiver sido encerrada, não caberá exclusão de licitante por motivo relacionado à habilitação, salvo em razão de fatos supervenientes ou só conhecidos após o julgamento.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "65": {
    numero: "65",
    ementa: "Art. 65º . As condições de habilitação serão definidas no edital.\n\n§ 1º As empresas criadas no exercício financeiro da licitação deverão atender a todas as exigências da habilitação e ficarão autorizadas a substituir os demonstrativos contábeis pelo balanço de abertura.\n\n§ 2º A habilitação poderá ser realizada por processo eletrônico de comunicação a distância, nos termos dispostos em regulamento.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "66": {
    numero: "66",
    ementa: "Art. 66º . A habilitação jurídica visa a demonstrar a capacidade de o licitante exercer direitos e assumir obrigações, e a documentação a ser apresentada por ele limita-se à comprovação de existência jurídica da pessoa e, quando cabível, de autorização para o exercício da atividade a ser contratada.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "67": {
    numero: "67",
    ementa: "Art. 67º . A documentação relativa à qualificação técnico-profissional e técnico-operacional será restrita a:\n\nI - apresentação de profissional, devidamente registrado no conselho profissional competente, quando for o caso, detentor de atestado de responsabilidade técnica por execução de obra ou serviço de características semelhantes, para fins de contratação;\n\nII - certidões ou atestados, regularmente emitidos pelo conselho profissional competente, quando for o caso, que demonstrem capacidade operacional na execução de serviços similares de complexidade tecnológica e operacional equivalente ou superior, bem como documentos comprobatórios emitidos na forma do\n\n§ 3º do",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "68": {
    numero: "68",
    ementa: "Art. 68º . As habilitações fiscal, social e trabalhista serão aferidas mediante a verificação dos seguintes requisitos:\n\nI - a inscrição no Cadastro de Pessoas Físicas (CPF) ou no Cadastro Nacional da Pessoa Jurídica (CNPJ);\n\nII - a inscrição no cadastro de contribuintes estadual e/ou municipal, se houver, relativo ao domicílio ou sede do licitante, pertinente ao seu ramo de atividade e compatível com o objeto contratual;\n\nIII - a regularidade perante a Fazenda federal, estadual e/ou municipal do domicílio ou sede do licitante, ou outra equivalente, na forma da lei;\n\nIV - a regularidade relativa à Seguridade Social e ao FGTS, que demonstre cumprimento dos encargos sociais instituídos por lei;\n\nV - a regularidade perante a Justiça do Trabalho;\n\nVI - o cumprimento do disposto no inciso XXXIII do",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "69": {
    numero: "69",
    ementa: "Art. 69º . A habilitação econômico-financeira visa a demonstrar a aptidão econômica do licitante para cumprir as obrigações decorrentes do futuro contrato, devendo ser comprovada de forma objetiva, por coeficientes e índices econômicos previstos no edital, devidamente justificados no processo licitatório, e será restrita à apresentação da seguinte documentação:\n\nI - balanço patrimonial, demonstração de resultado de exercício e demais demonstrações contábeis dos 2 (dois) últimos exercícios sociais;\n\nII - certidão negativa de feitos sobre falência expedida pelo distribuidor da sede do licitante.\n\n§ 1º A critério da Administração, poderá ser exigida declaração, assinada por profissional habilitado da área contábil, que ateste o atendimento pelo licitante dos índices econômicos previstos no edital.\n\n§ 2º Para o atendimento do disposto no caput deste artigo, é vedada a exigência de valores mínimos de faturamento anterior e de índices de rentabilidade ou lucratividade.\n\n§ 3º É admitida a exigência da relação dos compromissos assumidos pelo licitante que importem em diminuição de sua capacidade econômico-financeira, excluídas parcelas já executadas de contratos firmados.\n\n§ 4º A Administração, nas compras para entrega futura e na execução de obras e serviços, poderá estabelecer no edital a exigência de capital mínimo ou de patrimônio líquido mínimo equivalente a até 10% (dez por cento) do valor estimado da contratação.\n\n§ 5º É vedada a exigência de índices e valores não usualmente adotados para a avaliação de situação econômico-financeira suficiente para o cumprimento das obrigações decorrentes da licitação.\n\n§ 6º Os documentos referidos no inciso I do caput deste artigo limitar-se-ão ao último exercício no caso de a pessoa jurídica ter sido constituída há menos de 2 (dois) anos.",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "70": {
    numero: "70",
    ementa: "Art. 70º . A documentação referida neste Capítulo poderá ser:\n\nI - apresentada em original, por cópia ou por qualquer outro meio expressamente admitido pela Administração;\n\nII - substituída por registro cadastral emitido por órgão ou entidade pública, desde que previsto no edital e que o registro tenha sido feito em obediência ao disposto nesta Lei;\n\nIII - dispensada, total ou parcialmente, nas contratações para entrega imediata, nas contratações em valores inferiores a 1/4 (um quarto) do limite para dispensa de licitação para compras em geral e nas contratações de produto para pesquisa e desenvolvimento até o valor de R$ 300.000,00 (trezentos mil reais). (Vide Decreto nº 10.922, de 2021) (Vigência) (Vide Decreto nº 11.317, de 2022) Vigência (Vide Decreto nº 11.871, de 2023) Vigência (Vide Decreto nº 12.343, de 2024) Vigência Parágrafo único. As empresas estrangeiras que não funcionem no País deverão apresentar documentos equivalentes, na forma de regulamento emitido pelo Poder Executivo federal. DO ENCERRAMENTO DA LICITAÇÃO",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "71": {
    numero: "71",
    ementa: "Art. 71º . Encerradas as fases de julgamento e habilitação, e exauridos os recursos administrativos, o processo licitatório será encaminhado à autoridade superior, que poderá:\n\nI - determinar o retorno dos autos para saneamento de irregularidades;\n\nII - revogar a licitação por motivo de conveniência e oportunidade;\n\nIII - proceder à anulação da licitação, de ofício ou mediante provocação de terceiros, sempre que presente ilegalidade insanável;\n\nIV - adjudicar o objeto e homologar a licitação.\n\n§ 1º Ao pronunciar a nulidade, a autoridade indicará expressamente os atos com vícios insanáveis, tornando sem efeito todos os subsequentes que deles dependam, e dará ensejo à apuração de responsabilidade de quem lhes tenha dado causa.\n\n§ 2º O motivo determinante para a revogação do processo licitatório deverá ser resultante de fato superveniente devidamente comprovado.\n\n§ 3º Nos casos de anulação e revogação, deverá ser assegurada a prévia manifestação dos interessados.\n\n§ 4º O disposto neste artigo será aplicado, no que couber, à contratação direta e aos procedimentos auxiliares da licitação. DA CONTRATAÇÃO DIRETA Do Processo de Contratação Direta",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },

  // CAPÍTULO V - DA CONTRATAÇÃO DIRETA (Arts. 72 a 80)
  "72": {
    numero: "72",
    ementa: "Art. 72º . O processo de contratação direta, que compreende os casos de inexigibilidade e de dispensa de licitação, deverá ser instruído com os seguintes documentos:\n\nI - documento de formalização de demanda e, se for o caso, estudo técnico preliminar, análise de riscos, termo de referência, projeto básico ou projeto executivo;\n\nII - estimativa de despesa, que deverá ser calculada na forma estabelecida no",
    capitulo: "TÍTULO II - CAPÍTULO V",
    secao: "Contratação Direta"
  },
  "73": {
    numero: "73",
    ementa: "Art. 73º . Na hipótese de contratação direta indevida ocorrida com dolo, fraude ou erro grosseiro, o contratado e o agente público responsável responderão solidariamente pelo dano causado ao erário, sem prejuízo de outras sanções legais cabíveis. Da Inexigibilidade de Licitação",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "74": {
    numero: "74",
    ementa: "Art. 74º desta Lei, a locação de imóveis deverá ser precedida de licitação e avaliação prévia do bem, do seu estado de conservação, dos custos de adaptações e do prazo de amortização dos investimentos necessários. Das Licitações Internacionais",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "75": {
    numero: "75",
    ementa: "Art. 75º . É dispensável a licitação:\n\nI - para contratação que envolva valores inferiores a R$ 100.000,00 (cem mil reais), no caso de obras e serviços de engenharia ou de serviços de manutenção de veículos automotores; (Vide Decreto nº 10.922, de 2021) (Vigência) (Vide Decreto nº 11.317, de 2022) Vigência (Vide Decreto nº 11.871, de 2023) Vigência (Vide Decreto nº 12.343, de 2024) Vigência\n\nII - para contratação que envolva valores inferiores a R$ 50.000,00 (cinquenta mil reais), no caso de outros serviços e compras; (Vide Decreto nº 10.922, de 2021) (Vigência) (Vide Decreto nº 11.317, de 2022) Vigência (Vide Decreto nº 11.871, de 2023) Vigência (Vide Decreto nº 12.343, de 2024) Vigência\n\nIII - para contratação que mantenha todas as condições definidas em edital de licitação realizada há menos de 1 (um) ano, quando se verificar que naquela licitação:\n\na) não surgiram licitantes interessados ou não foram apresentadas propostas válidas;\n\nb) as propostas apresentadas consignaram preços manifestamente superiores aos praticados no mercado ou incompatíveis com os fixados pelos órgãos oficiais competentes;\n\nIV - para contratação que tenha por objeto:\n\na) bens, componentes ou peças de origem nacional ou estrangeira necessários à manutenção de equipamentos, a serem adquiridos do fornecedor original desses equipamentos durante o período de garantia técnica, quando essa condição de exclusividade for indispensável para a vigência da garantia;\n\nb) bens, serviços, alienações ou obras, nos termos de acordo internacional específico aprovado pelo Congresso Nacional, quando as condições ofertadas forem manifestamente vantajosas para a Administração;\n\nc) produtos para pesquisa e desenvolvimento, limitada a contratação, no caso de obras e serviços de engenharia, ao valor de R$ 300.000,00 (trezentos mil reais); (Vide Decreto nº 10.922, de 2021) (Vigência) (Vide Decreto nº 11.317, de 2022) Vigência (Vide Decreto nº 11.871, de 2023) Vigência (Vide Decreto nº 12.343, de 2024) Vigência\n\nd) transferência de tecnologia ou licenciamento de direito de uso ou de exploração de criação protegida, nas contratações realizadas por instituição científica, tecnológica e de inovação (ICT) pública ou por agência de fomento, desde que demonstrada vantagem para a Administração;\n\ne) hortifrutigranjeiros, pães e outros gêneros perecíveis, no período necessário para a realização dos processos licitatórios correspondentes, hipótese em que a contratação será realizada diretamente com base no preço do dia;\n\nf) bens ou serviços produzidos ou prestados no País que envolvam, cumulativamente, alta complexidade tecnológica e defesa nacional; g) materiais de uso das Forças Armadas, com exceção de materiais de uso pessoal e administrativo, quando houver necessidade de manter a padronização requerida pela estrutura de apoio logístico dos meios navais, aéreos e terrestres, mediante autorização por ato do comandante da força militar; h) bens e serviços para atendimento dos contingentes militares das forças singulares brasileiras empregadas em operações de paz no exterior, hipótese em que a contratação deverá ser justificada quanto ao preço e à escolha do fornecedor ou executante e ratificada pelo comandante da força militar; i) abastecimento ou suprimento de efetivos militares em estada eventual de curta duração em portos, aeroportos ou localidades diferentes de suas sedes, por motivo de movimentação operacional ou de adestramento; j) coleta, processamento e comercialização de resíduos sólidos urbanos recicláveis ou reutilizáveis, em áreas com sistema de coleta seletiva de lixo, realizados por associações ou cooperativas formadas exclusivamente de pessoas físicas de baixa renda reconhecidas pelo poder público como catadores de materiais recicláveis, com o uso de equipamentos compatíveis com as normas técnicas, ambientais e de saúde pública; k) aquisição ou restauração de obras de arte e objetos históricos, de autenticidade certificada, desde que inerente às finalidades do órgão ou com elas compatível; l) serviços especializados ou aquisição ou locação de equipamentos destinados ao rastreamento e à obtenção de provas previstas nos incisos II e V do caput do",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "76": {
    numero: "76",
    ementa: "Art. 76º . A alienação de bens da Administração Pública, subordinada à existência de interesse público devidamente justificado, será precedida de avaliação e obedecerá às seguintes normas:\n\nI - tratando-se de bens imóveis, inclusive os pertencentes às autarquias e às fundações, exigirá autorização legislativa e dependerá de licitação na modalidade leilão, dispensada a realização de licitação nos casos de:\n\na) dação em pagamento;\n\nb) doação, permitida exclusivamente para outro órgão ou entidade da Administração Pública, de qualquer esfera de governo, ressalvado o disposto nas alíneas f, g e h deste inciso;\n\nc) permuta por outros imóveis que atendam aos requisitos relacionados às finalidades precípuas da Administração, desde que a diferença apurada não ultrapasse a metade do valor do imóvel que será ofertado pela União, segundo avaliação prévia, e ocorra a torna de valores, sempre que for o caso;\n\nd) investidura;\n\ne) venda a outro órgão ou entidade da Administração Pública de qualquer esfera de governo;\n\nf) alienação gratuita ou onerosa, aforamento, concessão de direito real de uso, locação e permissão de uso de bens imóveis residenciais construídos, destinados ou efetivamente usados em programas de habitação ou de regularização fundiária de interesse social desenvolvidos por órgão ou entidade da Administração Pública; g) alienação gratuita ou onerosa, aforamento, concessão de direito real de uso, locação e permissão de uso de bens imóveis comerciais de âmbito local, com área de até 250 m² (duzentos e cinquenta metros quadrados) e destinados a programas de regularização fundiária de interesse social desenvolvidos por órgão ou entidade da Administração Pública; h) alienação e concessão de direito real de uso, gratuita ou onerosa, de terras públicas rurais da União e do Instituto Nacional de Colonização e Reforma Agrária (Incra) onde incidam ocupações até o limite de que trata o\n\n§ 1º do",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "77": {
    numero: "77",
    ementa: "Art. 77º . Para a venda de bens imóveis, será concedido direito de preferência ao licitante que, submetendo-se a todas as regras do edital, comprove a ocupação do imóvel objeto da licitação. DOS INSTRUMENTOS AUXILIARES Dos Procedimentos Auxiliares",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "78": {
    numero: "78",
    ementa: "Art. 78º desta Lei.\n\n§ 2º É vedada a criação de outras modalidades de licitação ou, ainda, a combinação daquelas referidas no caput deste artigo.",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "79": {
    numero: "79",
    ementa: "Art. 79º . O credenciamento poderá ser usado nas seguintes hipóteses de contratação: Regulamento\n\nI - paralela e não excludente: caso em que é viável e vantajosa para a Administração a realização de contratações simultâneas em condições padronizadas;\n\nII - com seleção a critério de terceiros: caso em que a seleção do contratado está a cargo do beneficiário direto da prestação;\n\nIII - em mercados fluidos: caso em que a flutuação constante do valor da prestação e das condições de contratação inviabiliza a seleção de agente por meio de processo de licitação. Parágrafo único. Os procedimentos de credenciamento serão definidos em regulamento, observadas as seguintes regras:\n\nI - a Administração deverá divulgar e manter à disposição do público, em sítio eletrônico oficial, edital de chamamento de interessados, de modo a permitir o cadastramento permanente de novos interessados;\n\nII - na hipótese do inciso I do caput deste artigo, quando o objeto não permitir a contratação imediata e simultânea de todos os credenciados, deverão ser adotados critérios objetivos de distribuição da demanda;\n\nIII - o edital de chamamento de interessados deverá prever as condições padronizadas de contratação e, nas hipóteses dos incisos I e II do caput deste artigo, deverá definir o valor da contratação;\n\nIV - na hipótese do inciso III do caput deste artigo, a Administração deverá registrar as cotações de mercado vigentes no momento da contratação;\n\nV - não será permitido o cometimento a terceiros do objeto contratado sem autorização expressa da Administração;\n\nVI - será admitida a denúncia por qualquer das partes nos prazos fixados no edital. Da Pré-Qualificação",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "80": {
    numero: "80",
    ementa: "Art. 80º . A pré-qualificação é o procedimento técnico-administrativo para selecionar previamente:\n\nI - licitantes que reúnam condições de habilitação para participar de futura licitação ou de licitação vinculada a programas de obras ou de serviços objetivamente definidos;\n\nII - bens que atendam às exigências técnicas ou de qualidade estabelecidas pela Administração.\n\n§ 1º Na pré-qualificação observar-se-á o seguinte:\n\nI - quando aberta a licitantes, poderão ser dispensados os documentos que já constarem do registro cadastral;\n\nII - quando aberta a bens, poderá ser exigida a comprovação de qualidade.\n\n§ 2º O procedimento de pré-qualificação ficará permanentemente aberto para a inscrição de interessados.\n\n§ 3º Quanto ao procedimento de pré-qualificação, constarão do edital:\n\nI - as informações mínimas necessárias para definição do objeto;\n\nII - a modalidade, a forma da futura licitação e os critérios de julgamento.\n\n§ 4º A apresentação de documentos far-se-á perante órgão ou comissão indicada pela Administração, que deverá examiná-los no prazo máximo de 10 (dez) dias úteis e determinar correção ou reapresentação de documentos, quando for o caso, com vistas à ampliação da competição.\n\n§ 5º Os bens e os serviços pré-qualificados deverão integrar o catálogo de bens e serviços da Administração.\n\n§ 6º A pré-qualificação poderá ser realizada em grupos ou segmentos, segundo as especialidades dos fornecedores.\n\n§ 7º A pré-qualificação poderá ser parcial ou total, com alguns ou todos os requisitos técnicos ou de habilitação necessários à contratação, assegurada, em qualquer hipótese, a igualdade de condições entre os concorrentes.\n\n§ 8º Quanto ao prazo, a pré-qualificação terá validade:\n\nI - de 1 (um) ano, no máximo, e poderá ser atualizada a qualquer tempo;\n\nII - não superior ao prazo de validade dos documentos apresentados pelos interessados.\n\n§ 9º Os licitantes e os bens pré-qualificados serão obrigatoriamente divulgados e mantidos à disposição do público. § 10. A licitação que se seguir ao procedimento da pré-qualificação poderá ser restrita a licitantes ou bens pré-qualificados. Do Procedimento de Manifestação de Interesse",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },

  // CAPÍTULO VI - DO SISTEMA DE REGISTRO DE PREÇOS (Arts. 81 a 86)
  "81": {
    numero: "81",
    ementa: "Art. 81º . A Administração poderá solicitar à iniciativa privada, mediante procedimento aberto de manifestação de interesse a ser iniciado com a publicação de edital de chamamento público, a propositura e a realização de estudos, investigações, levantamentos e projetos de soluções inovadoras que contribuam com questões de relevância pública, na forma de regulamento.\n\n§ 1º Os estudos, as investigações, os levantamentos e os projetos vinculados à contratação e de utilidade para a licitação, realizados pela Administração ou com a sua autorização, estarão à disposição dos interessados, e o vencedor da licitação deverá ressarcir os dispêndios correspondentes, conforme especificado no edital.\n\n§ 2º A realização, pela iniciativa privada, de estudos, investigações, levantamentos e projetos em decorrência do procedimento de manifestação de interesse previsto no caput deste artigo:\n\nI - não atribuirá ao realizador direito de preferência no processo licitatório;\n\nII - não obrigará o poder público a realizar licitação;\n\nIII - não implicará, por si só, direito a ressarcimento de valores envolvidos em sua elaboração;\n\nIV - será remunerada somente pelo vencedor da licitação, vedada, em qualquer hipótese, a cobrança de valores do poder público.\n\n§ 3º Para aceitação dos produtos e serviços de que trata o caput deste artigo, a Administração deverá elaborar parecer fundamentado com a demonstração de que o produto ou serviço entregue é adequado e suficiente à compreensão do objeto, de que as premissas adotadas são compatíveis com as reais necessidades do órgão e de que a metodologia proposta é a que propicia maior economia e vantagem entre as demais possíveis.\n\n§ 4º O procedimento previsto no caput deste artigo poderá ser restrito a startups, assim considerados os microempreendedores individuais, as microempresas e as empresas de pequeno porte, de natureza emergente e com grande potencial, que se dediquem à pesquisa, ao desenvolvimento e à implementação de novos produtos ou serviços baseados em soluções tecnológicas inovadoras que possam causar alto impacto, exigida, na seleção definitiva da inovação, validação prévia fundamentada em métricas objetivas, de modo a demonstrar o atendimento das necessidades da Administração. Do Sistema de Registro de Preços",
    capitulo: "TÍTULO II - CAPÍTULO VI",
    secao: "Sistema de Registro de Preços"
  },
  "82": {
    numero: "82",
    ementa: "Art. 82º . O edital de licitação para registro de preços observará as regras gerais desta Lei e deverá dispor sobre:\n\nI - as especificidades da licitação e de seu objeto, inclusive a quantidade máxima de cada item que poderá ser adquirida;\n\nII - a quantidade mínima a ser cotada de unidades de bens ou, no caso de serviços, de unidades de medida;\n\nIII - a possibilidade de prever preços diferentes:\n\na) quando o objeto for realizado ou entregue em locais diferentes;\n\nb) em razão da forma e do local de acondicionamento;\n\nc) quando admitida cotação variável em razão do tamanho do lote;\n\nd) por outros motivos justificados no processo;\n\nIV - a possibilidade de o licitante oferecer ou não proposta em quantitativo inferior ao máximo previsto no edital, obrigando-se nos limites dela;\n\nV - o critério de julgamento da licitação, que será o de menor preço ou o de maior desconto sobre tabela de preços praticada no mercado;\n\nVI - as condições para alteração de preços registrados;\n\nVII - o registro de mais de um fornecedor ou prestador de serviço, desde que aceitem cotar o objeto em preço igual ao do licitante vencedor, assegurada a preferência de contratação de acordo com a ordem de classificação;\n\nVIII - a vedação à participação do órgão ou entidade em mais de uma ata de registro de preços com o mesmo objeto no prazo de validade daquela de que já tiver participado, salvo na ocorrência de ata que tenha registrado quantitativo inferior ao máximo previsto no edital;\n\nIX - as hipóteses de cancelamento da ata de registro de preços e suas consequências.\n\n§ 1º O critério de julgamento de menor preço por grupo de itens somente poderá ser adotado quando for demonstrada a inviabilidade de se promover a adjudicação por item e for evidenciada a sua vantagem técnica e econômica, e o critério de aceitabilidade de preços unitários máximos deverá ser indicado no edital.\n\n§ 2º Na hipótese de que trata o\n\n§ 1º deste artigo, observados os parâmetros estabelecidos nos §§ 1º, 2º e 3º do",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "83": {
    numero: "83",
    ementa: "Art. 83º . A existência de preços registrados implicará compromisso de fornecimento nas condições estabelecidas, mas não obrigará a Administração a contratar, facultada a realização de licitação específica para a aquisição pretendida, desde que devidamente motivada.",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "84": {
    numero: "84",
    ementa: "Art. 84º . O prazo de vigência da ata de registro de preços será de 1 (um) ano e poderá ser prorrogado, por igual período, desde que comprovado o preço vantajoso. Parágrafo único. O contrato decorrente da ata de registro de preços terá sua vigência estabelecida em conformidade com as disposições nela contidas.",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "85": {
    numero: "85",
    ementa: "Art. 85º . A Administração poderá contratar a execução de obras e serviços de engenharia pelo sistema de registro de preços, desde que atendidos os seguintes requisitos:\n\nI - existência de projeto padronizado, sem complexidade técnica e operacional;\n\nII - necessidade permanente ou frequente de obra ou serviço a ser contratado.",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "86": {
    numero: "86",
    ementa: "Art. 86º . O órgão ou entidade gerenciadora deverá, na fase preparatória do processo licitatório, para fins de registro de preços, realizar procedimento público de intenção de registro de preços para, nos termos de regulamento, possibilitar, pelo prazo mínimo de 8 (oito) dias úteis, a participação de outros órgãos ou entidades na respectiva ata e determinar a estimativa total de quantidades da contratação.\n\n§ 1º O procedimento previsto no caput deste artigo será dispensável quando o órgão ou entidade gerenciadora for o único contratante.\n\n§ 2º Se não participarem do procedimento previsto no caput deste artigo, os órgãos e entidades poderão aderir à ata de registro de preços na condição de não participantes, observados os seguintes requisitos:\n\nI - apresentação de justificativa da vantagem da adesão, inclusive em situações de provável desabastecimento ou descontinuidade de serviço público;\n\nII - demonstração de que os valores registrados estão compatíveis com os valores praticados pelo mercado na forma do",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },

  // CAPÍTULO VII - DA PRÉ-QUALIFICAÇÃO E DO CADASTRO (Arts. 87 a 88)
  "87": {
    numero: "87",
    ementa: "Art. 87º . Para os fins desta Lei, os órgãos e entidades da Administração Pública deverão utilizar o sistema de registro cadastral unificado disponível no Portal Nacional de Contratações Públicas (PNCP), para efeito de cadastro unificado de licitantes, na forma disposta em regulamento.\n\n§ 1º O sistema de registro cadastral unificado será público e deverá ser amplamente divulgado e estar permanentemente aberto aos interessados, e será obrigatória a realização de chamamento público pela internet, no mínimo anualmente, para atualização dos registros existentes e para ingresso de novos interessados.\n\n§ 2º É proibida a exigência, pelo órgão ou entidade licitante, de registro cadastral complementar para acesso a edital e anexos.\n\n§ 3º A Administração poderá realizar licitação restrita a fornecedores cadastrados, atendidos os critérios, as condições e os limites estabelecidos em regulamento, bem como a ampla publicidade dos procedimentos para o cadastramento.\n\n§ 4º Na hipótese a que se refere o\n\n§ 3º deste artigo, será admitido fornecedor que realize seu cadastro dentro do prazo previsto no edital para apresentação de propostas.",
    capitulo: "TÍTULO II - CAPÍTULO VII",
    secao: "Pré-qualificação e Cadastro"
  },
  "88": {
    numero: "88",
    ementa: "Art. 88º desta Lei e em regulamento.",
    capitulo: "TÍTULO II - CAPÍTULO VII"
  },

  // TÍTULO III - DOS CONTRATOS
  // CAPÍTULO I - DAS DISPOSIÇÕES GERAIS SOBRE OS CONTRATOS (Arts. 89 a 114)
  "89": {
    numero: "89",
    ementa: "Art. 89º . Os contratos de que trata esta Lei regular-se-ão pelas suas cláusulas e pelos preceitos de direito público, e a eles serão aplicados, supletivamente, os princípios da teoria geral dos contratos e as disposições de direito privado.\n\n§ 1º Todo contrato deverá mencionar os nomes das partes e os de seus representantes, a finalidade, o ato que autorizou sua lavratura, o número do processo da licitação ou da contratação direta e a sujeição dos contratantes às normas desta Lei e às cláusulas contratuais.\n\n§ 2º Os contratos deverão estabelecer com clareza e precisão as condições para sua execução, expressas em cláusulas que definam os direitos, as obrigações e as responsabilidades das partes, em conformidade com os termos do edital de licitação e os da proposta vencedora ou com os termos do ato que autorizou a contratação direta e os da respectiva proposta.",
    capitulo: "TÍTULO III - CAPÍTULO I",
    secao: "Disposições Gerais sobre Contratos"
  },
  "90": {
    numero: "90",
    ementa: "Art. 90º . A Administração convocará regularmente o licitante vencedor para assinar o termo de contrato ou para aceitar ou retirar o instrumento equivalente, dentro do prazo e nas condições estabelecidas no edital de licitação, sob pena de decair o direito à contratação, sem prejuízo das sanções previstas nesta Lei.\n\n§ 1º O prazo de convocação poderá ser prorrogado 1 (uma) vez, por igual período, mediante solicitação da parte durante seu transcurso, devidamente justificada, e desde que o motivo apresentado seja aceito pela Administração.\n\n§ 2º Será facultado à Administração, quando o convocado não assinar o termo de contrato ou não aceitar ou não retirar o instrumento equivalente no prazo e nas condições estabelecidas, convocar os licitantes remanescentes, na ordem de classificação, para a celebração do contrato nas condições propostas pelo licitante vencedor.\n\n§ 3º Decorrido o prazo de validade da proposta indicado no edital sem convocação para a contratação, ficarão os licitantes liberados dos compromissos assumidos.\n\n§ 4º Na hipótese de nenhum dos licitantes aceitar a contratação nos termos do\n\n§ 2º deste artigo, a Administração, observados o valor estimado e sua eventual atualização nos termos do edital, poderá:\n\nI - convocar os licitantes remanescentes para negociação, na ordem de classificação, com vistas à obtenção de preço melhor, mesmo que acima do preço do adjudicatário;\n\nII - adjudicar e celebrar o contrato nas condições ofertadas pelos licitantes remanescentes, atendida a ordem classificatória, quando frustrada a negociação de melhor condição.\n\n§ 5º A recusa injustificada do adjudicatário em assinar o contrato ou em aceitar ou retirar o instrumento equivalente no prazo estabelecido pela Administração caracterizará o descumprimento total da obrigação assumida e o sujeitará às penalidades legalmente estabelecidas e à imediata perda da garantia de proposta em favor do órgão ou entidade licitante.\n\n§ 6º A regra do\n\n§ 5º não se aplicará aos licitantes remanescentes convocados na forma do inciso I do\n\n§ 4º deste artigo.\n\n§ 7º Será facultada à Administração a convocação dos demais licitantes classificados para a contratação de remanescente de obra, de serviço ou de fornecimento em consequência de rescisão contratual, observados os mesmos critérios estabelecidos nos §§ 2º e 4º deste artigo.\n\n§ 8º Na situação de que trata o\n\n§ 7º deste artigo, é autorizado o aproveitamento, em favor da nova contratada, de eventual saldo a liquidar inscrito em despesas empenhadas ou em restos a pagar não processados. (Incluído pela Lei nº 14.770, de 2023)\n\n§ 9º Se frustradas as providências dos §§ 2º e 4º, o saldo de que trata o\n\n§ 8º deste artigo poderá ser computado como efetiva disponibilidade para nova licitação, desde que identificada vantajosidade para a administração pública e mantido o objeto programado. (Incluído pela Lei nº 14.770, de 2023)",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "91": {
    numero: "91",
    ementa: "Art. 91º . Os contratos e seus aditamentos terão forma escrita e serão juntados ao processo que tiver dado origem à contratação, divulgados e mantidos à disposição do público em sítio eletrônico oficial.\n\n§ 1º Será admitida a manutenção em sigilo de contratos e de termos aditivos quando imprescindível à segurança da sociedade e do Estado, nos termos da legislação que regula o acesso à informação.\n\n§ 2º Contratos relativos a direitos reais sobre imóveis serão formalizados por escritura pública lavrada em notas de tabelião, cujo teor deverá ser divulgado e mantido à disposição do público em sítio eletrônico oficial.\n\n§ 3º Será admitida a forma eletrônica na celebração de contratos e de termos aditivos, atendidas as exigências previstas em regulamento.\n\n§ 4º Antes de formalizar ou prorrogar o prazo de vigência do contrato, a Administração deverá verificar a regularidade fiscal do contratado, consultar o Cadastro Nacional de Empresas Inidôneas e Suspensas (Ceis) e o Cadastro Nacional de Empresas Punidas (Cnep), emitir as certidões negativas de inidoneidade, de impedimento e de débitos trabalhistas e juntá-las ao respectivo processo.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "92": {
    numero: "92",
    ementa: "Art. 92º . São necessárias em todo contrato cláusulas que estabeleçam:\n\nI - o objeto e seus elementos característicos;\n\nII - a vinculação ao edital de licitação e à proposta do licitante vencedor ou ao ato que tiver autorizado a contratação direta e à respectiva proposta;\n\nIII - a legislação aplicável à execução do contrato, inclusive quanto aos casos omissos;\n\nIV - o regime de execução ou a forma de fornecimento;\n\nV - o preço e as condições de pagamento, os critérios, a data-base e a periodicidade do reajustamento de preços e os critérios de atualização monetária entre a data do adimplemento das obrigações e a do efetivo pagamento;\n\nVI - os critérios e a periodicidade da medição, quando for o caso, e o prazo para liquidação e para pagamento;\n\nVII - os prazos de início das etapas de execução, conclusão, entrega, observação e recebimento definitivo, quando for o caso;\n\nVIII - o crédito pelo qual correrá a despesa, com a indicação da classificação funcional programática e da categoria econômica;\n\nIX - a matriz de risco, quando for o caso;\n\nX - o prazo para resposta ao pedido de repactuação de preços, quando for o caso;\n\nXI - o prazo para resposta ao pedido de restabelecimento do equilíbrio econômico-financeiro, quando for o caso;\n\nXII - as garantias oferecidas para assegurar sua plena execução, quando exigidas, inclusive as que forem oferecidas pelo contratado no caso de antecipação de valores a título de pagamento; XIII - o prazo de garantia mínima do objeto, observados os prazos mínimos estabelecidos nesta Lei e nas normas técnicas aplicáveis, e as condições de manutenção e assistência técnica, quando for o caso; XIV - os direitos e as responsabilidades das partes, as penalidades cabíveis e os valores das multas e suas bases de cálculo; XV - as condições de importação e a data e a taxa de câmbio para conversão, quando for o caso; XVI - a obrigação do contratado de manter, durante toda a execução do contrato, em compatibilidade com as obrigações por ele assumidas, todas as condições exigidas para a habilitação na licitação, ou para a qualificação, na contratação direta; XVII - a obrigação de o contratado cumprir as exigências de reserva de cargos prevista em lei, bem como em outras normas específicas, para pessoa com deficiência, para reabilitado da Previdência Social e para aprendiz; XVIII - o modelo de gestão do contrato, observados os requisitos definidos em regulamento; XIX - os casos de extinção.\n\n§ 1º Os contratos celebrados pela Administração Pública com pessoas físicas ou jurídicas, inclusive as domiciliadas no exterior, deverão conter cláusula que declare competente o foro da sede da Administração para dirimir qualquer questão contratual, ressalvadas as seguintes hipóteses:\n\nI - licitação internacional para a aquisição de bens e serviços cujo pagamento seja feito com o produto de financiamento concedido por organismo financeiro internacional de que o Brasil faça parte ou por agência estrangeira de cooperação;\n\nII - contratação com empresa estrangeira para a compra de equipamentos fabricados e entregues no exterior precedida de autorização do Chefe do Poder Executivo;\n\nIII - aquisição de bens e serviços realizada por unidades administrativas com sede no exterior.\n\n§ 2º De acordo com as peculiaridades de seu objeto e de seu regime de execução, o contrato conterá cláusula que preveja período antecedente à expedição da ordem de serviço para verificação de pendências, liberação de áreas ou adoção de outras providências cabíveis para a regularidade do início de sua execução.\n\n§ 3º Independentemente do prazo de duração, o contrato deverá conter cláusula que estabeleça o índice de reajustamento de preço, com data-base vinculada à data do orçamento estimado, e poderá ser estabelecido mais de um índice específico ou setorial, em conformidade com a realidade de mercado dos respectivos insumos.\n\n§ 4º Nos contratos de serviços contínuos, observado o interregno mínimo de 1 (um) ano, o critério de reajustamento de preços será por:\n\nI - reajustamento em sentido estrito, quando não houver regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, mediante previsão de índices específicos ou setoriais;\n\nII - repactuação, quando houver regime de dedicação exclusiva de mão de obra ou predominância de mão de obra, mediante demonstração analítica da variação dos custos.\n\n§ 5º Nos contratos de obras e serviços de engenharia, sempre que compatível com o regime de execução, a medição será mensal.\n\n§ 6º Nos contratos para serviços contínuos com regime de dedicação exclusiva de mão de obra ou com predominância de mão de obra, o prazo para resposta ao pedido de repactuação de preços será preferencialmente de 1 (um) mês, contado da data do fornecimento da documentação prevista no\n\n§ 6º do",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "93": {
    numero: "93",
    ementa: "Art. 93º desta Lei, todos os direitos patrimoniais relativos ao projeto e autorizar sua execução conforme juízo de conveniência e oportunidade das autoridades competentes.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "94": {
    numero: "94",
    ementa: "Art. 94º . A divulgação no Portal Nacional de Contratações Públicas (PNCP) é condição indispensável para a eficácia do contrato e de seus aditamentos e deverá ocorrer nos seguintes prazos, contados da data de sua assinatura:\n\nI - 20 (vinte) dias úteis, no caso de licitação;\n\nII - 10 (dez) dias úteis, no caso de contratação direta.\n\n§ 1º Os contratos celebrados em caso de urgência terão eficácia a partir de sua assinatura e deverão ser publicados nos prazos previstos nos incisos I e II do caput deste artigo, sob pena de nulidade.\n\n§ 2º A divulgação de que trata o caput deste artigo, quando referente à contratação de profissional do setor artístico por inexigibilidade, deverá identificar os custos do cachê do artista, dos músicos ou da banda, quando houver, do transporte, da hospedagem, da infraestrutura, da logística do evento e das demais despesas específicas.\n\n§ 3º No caso de obras, a Administração divulgará em sítio eletrônico oficial, em até 25 (vinte e cinco) dias úteis após a assinatura do contrato, os quantitativos e os preços unitários e totais que contratar e, em até 45 (quarenta e cinco) dias úteis após a conclusão do contrato, os quantitativos executados e os preços praticados.\n\n§ 4º (VETADO).\n\n§ 5º (VETADO).",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "95": {
    numero: "95",
    ementa: "Art. 95º . O instrumento de contrato é obrigatório, salvo nas seguintes hipóteses, em que a Administração poderá substituí-lo por outro instrumento hábil, como carta-contrato, nota de empenho de despesa, autorização de compra ou ordem de execução de serviço:\n\nI - dispensa de licitação em razão de valor;\n\nII - compras com entrega imediata e integral dos bens adquiridos e dos quais não resultem obrigações futuras, inclusive quanto a assistência técnica, independentemente de seu valor.\n\n§ 1º Às hipóteses de substituição do instrumento de contrato, aplica-se, no que couber, o disposto no",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "96": {
    numero: "96",
    ementa: "Art. 96º desta Lei. DO JULGAMENTO",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "97": {
    numero: "97",
    ementa: "Art. 97º . O seguro-garantia tem por objetivo garantir o fiel cumprimento das obrigações assumidas pelo contratado perante à Administração, inclusive as multas, os prejuízos e as indenizações decorrentes de inadimplemento, observadas as seguintes regras nas contratações regidas por esta Lei:\n\nI - o prazo de vigência da apólice será igual ou superior ao prazo estabelecido no contrato principal e deverá acompanhar as modificações referentes à vigência deste mediante a emissão do respectivo endosso pela seguradora;\n\nII - o seguro-garantia continuará em vigor mesmo se o contratado não tiver pago o prêmio nas datas convencionadas. Parágrafo único. Nos contratos de execução continuada ou de fornecimento contínuo de bens e serviços, será permitida a substituição da apólice de seguro-garantia na data de renovação ou de aniversário, desde que mantidas as mesmas condições e coberturas da apólice vigente e desde que nenhum período fique descoberto, ressalvado o disposto no\n\n§ 2º do",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "98": {
    numero: "98",
    ementa: "Art. 98º . Nas contratações de obras, serviços e fornecimentos, a garantia poderá ser de até 5% (cinco por cento) do valor inicial do contrato, autorizada a majoração desse percentual para até 10% (dez por cento), desde que justificada mediante análise da complexidade técnica e dos riscos envolvidos. Parágrafo único. Nas contratações de serviços e fornecimentos contínuos com vigência superior a 1 (um) ano, assim como nas subsequentes prorrogações, será utilizado o valor anual do contrato para definição e aplicação dos percentuais previstos no caput deste artigo.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "99": {
    numero: "99",
    ementa: "Art. 99º . Nas contratações de obras e serviços de engenharia de grande vulto, poderá ser exigida a prestação de garantia, na modalidade seguro-garantia, com cláusula de retomada prevista no",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "100": {
    numero: "100",
    ementa: "Art. 100º . A garantia prestada pelo contratado será liberada ou restituída após a fiel execução do contrato ou após a sua extinção por culpa exclusiva da Administração e, quando em dinheiro, atualizada monetariamente.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "101": {
    numero: "101",
    ementa: "Art. 101º . Nos casos de contratos que impliquem a entrega de bens pela Administração, dos quais o contratado ficará depositário, o valor desses bens deverá ser acrescido ao valor da garantia.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "102": {
    numero: "102",
    ementa: "Art. 102º desta Lei, em percentual equivalente a até 30% (trinta por cento) do valor inicial do contrato.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "103": {
    numero: "103",
    ementa: "Art. 103º . O contrato poderá identificar os riscos contratuais previstos e presumíveis e prever matriz de alocação de riscos, alocando-os entre contratante e contratado, mediante indicação daqueles a serem assumidos pelo setor público ou pelo setor privado ou daqueles a serem compartilhados.\n\n§ 1º A alocação de riscos de que trata o caput deste artigo considerará, em compatibilidade com as obrigações e os encargos atribuídos às partes no contrato, a natureza do risco, o beneficiário das prestações a que se vincula e a capacidade de cada setor para melhor gerenciá-lo.\n\n§ 2º Os riscos que tenham cobertura oferecida por seguradoras serão preferencialmente transferidos ao contratado.\n\n§ 3º A alocação dos riscos contratuais será quantificada para fins de projeção dos reflexos de seus custos no valor estimado da contratação.\n\n§ 4º A matriz de alocação de riscos definirá o equilíbrio econômico-financeiro inicial do contrato em relação a eventos supervenientes e deverá ser observada na solução de eventuais pleitos das partes.\n\n§ 5º Sempre que atendidas as condições do contrato e da matriz de alocação de riscos, será considerado mantido o equilíbrio econômico-financeiro, renunciando as partes aos pedidos de restabelecimento do equilíbrio relacionados aos riscos assumidos, exceto no que se refere:\n\nI - às alterações unilaterais determinadas pela Administração, nas hipóteses do inciso I do caput do",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "104": {
    numero: "104",
    ementa: "Art. 104º . O regime jurídico dos contratos instituído por esta Lei confere à Administração, em relação a eles, as prerrogativas de:\n\nI - modificá-los, unilateralmente, para melhor adequação às finalidades de interesse público, respeitados os direitos do contratado;\n\nII - extingui-los, unilateralmente, nos casos especificados nesta Lei;\n\nIII - fiscalizar sua execução;\n\nIV - aplicar sanções motivadas pela inexecução total ou parcial do ajuste;\n\nV - ocupar provisoriamente bens móveis e imóveis e utilizar pessoal e serviços vinculados ao objeto do contrato nas hipóteses de:\n\na) risco à prestação de serviços essenciais;\n\nb) necessidade de acautelar apuração administrativa de faltas contratuais pelo contratado, inclusive após extinção do contrato.\n\n§ 1º As cláusulas econômico-financeiras e monetárias dos contratos não poderão ser alteradas sem prévia concordância do contratado.\n\n§ 2º Na hipótese prevista no inciso I do caput deste artigo, as cláusulas econômico-financeiras do contrato deverão ser revistas para que se mantenha o equilíbrio contratual. DA DURAÇÃO DOS CONTRATOS",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "105": {
    numero: "105",
    ementa: "Art. 105º . A duração dos contratos regidos por esta Lei será a prevista em edital, e deverão ser observadas, no momento da contratação e a cada exercício financeiro, a disponibilidade de créditos orçamentários, bem como a previsão no plano plurianual, quando ultrapassar 1 (um) exercício financeiro. Parágrafo único. Não serão objeto de cancelamento automático os restos a pagar vinculados a contratos de duração plurianual, senão depois de encerrada a vigência destes, nem os vinculados a contratos rescindidos, nos casos dos §§ 8º e 9º do",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "106": {
    numero: "106",
    ementa: "Art. 106º . A Administração poderá celebrar contratos com prazo de até 5 (cinco) anos nas hipóteses de serviços e fornecimentos contínuos, observadas as seguintes diretrizes:\n\nI - a autoridade competente do órgão ou entidade contratante deverá atestar a maior vantagem econômica vislumbrada em razão da contratação plurianual;\n\nII - a Administração deverá atestar, no início da contratação e de cada exercício, a existência de créditos orçamentários vinculados à contratação e a vantagem em sua manutenção;\n\nIII - a Administração terá a opção de extinguir o contrato, sem ônus, quando não dispuser de créditos orçamentários para sua continuidade ou quando entender que o contrato não mais lhe oferece vantagem.\n\n§ 1º A extinção mencionada no inciso III do caput deste artigo ocorrerá apenas na próxima data de aniversário do contrato e não poderá ocorrer em prazo inferior a 2 (dois) meses, contado da referida data.\n\n§ 2º Aplica-se o disposto neste artigo ao aluguel de equipamentos e à utilização de programas de informática.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "107": {
    numero: "107",
    ementa: "Art. 107º . Os contratos de serviços e fornecimentos contínuos poderão ser prorrogados sucessivamente, respeitada a vigência máxima decenal, desde que haja previsão em edital e que a autoridade competente ateste que as condições e os preços permanecem vantajosos para a Administração, permitida a negociação com o contratado ou a extinção contratual sem ônus para qualquer das partes.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "108": {
    numero: "108",
    ementa: "Art. 108º . A Administração poderá celebrar contratos com prazo de até 10 (dez) anos nas hipóteses previstas nas alíneas f e g do inciso IV e nos incisos V, VI, XII e XVI do caput do",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "109": {
    numero: "109",
    ementa: "Art. 109º . A Administração poderá estabelecer a vigência por prazo indeterminado nos contratos em que seja usuária de serviço público oferecido em regime de monopólio, desde que comprovada, a cada exercício financeiro, a existência de créditos orçamentários vinculados à contratação.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "110": {
    numero: "110",
    ementa: "Art. 110º . Na contratação que gere receita e no contrato de eficiência que gere economia para a Administração, os prazos serão de:\n\nI - até 10 (dez) anos, nos contratos sem investimento;\n\nII - até 35 (trinta e cinco) anos, nos contratos com investimento, assim considerados aqueles que impliquem a elaboração de benfeitorias permanentes, realizadas exclusivamente a expensas do contratado, que serão revertidas ao patrimônio da Administração Pública ao término do contrato.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "111": {
    numero: "111",
    ementa: "Art. 111º . Na contratação que previr a conclusão de escopo predefinido, o prazo de vigência será automaticamente prorrogado quando seu objeto não for concluído no período firmado no contrato. Parágrafo único. Quando a não conclusão decorrer de culpa do contratado:\n\nI - o contratado será constituído em mora, aplicáveis a ele as respectivas sanções administrativas;\n\nII - a Administração poderá optar pela extinção do contrato e, nesse caso, adotará as medidas admitidas em lei para a continuidade da execução contratual.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "112": {
    numero: "112",
    ementa: "Art. 112º . Os prazos contratuais previstos nesta Lei não excluem nem revogam os prazos contratuais previstos em lei especial.",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "113": {
    numero: "113",
    ementa: "Art. 113º . O contrato firmado sob o regime de fornecimento e prestação de serviço associado terá sua vigência máxima definida pela soma do prazo relativo ao fornecimento inicial ou à entrega da obra com o prazo relativo ao serviço de operação e manutenção, este limitado a 5 (cinco) anos contados da data de recebimento do objeto inicial, autorizada a prorrogação na forma do",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "114": {
    numero: "114",
    ementa: "Art. 114º . O contrato que previr a operação continuada de sistemas estruturantes de tecnologia da informação poderá ter vigência máxima de 15 (quinze) anos. DA EXECUÇÃO DOS CONTRATOS",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },

  // CAPÍTULO II - DA EXECUÇÃO DOS CONTRATOS (Arts. 115 a 123)
  "115": {
    numero: "115",
    ementa: "Art. 115º . O contrato deverá ser executado fielmente pelas partes, de acordo com as cláusulas avençadas e as normas desta Lei, e cada parte responderá pelas consequências de sua inexecução total ou parcial.\n\n§ 1º É proibido à Administração retardar imotivadamente a execução de obra ou serviço, ou de suas parcelas, inclusive na hipótese de posse do respectivo chefe do Poder Executivo ou de novo titular no órgão ou entidade contratante.\n\n§ 2º (VETADO).\n\n§ 3º (VETADO).\n\n§ 4º (VETADO).\n\n§ 4º Nas contratações de obras e serviços de engenharia, sempre que a responsabilidade pelo licenciamento ambiental for da Administração, a manifestação prévia ou licença prévia, quando cabíveis, deverão ser obtidas antes da divulgação do edital. (Promulgação partes vetadas)\n\n§ 5º Em caso de impedimento, ordem de paralisação ou suspensão do contrato, o cronograma de execução será prorrogado automaticamente pelo tempo correspondente, anotadas tais circunstâncias mediante simples apostila.\n\n§ 6º Nas contratações de obras, verificada a ocorrência do disposto no\n\n§ 5º deste artigo por mais de 1 (um) mês, a Administração deverá divulgar, em sítio eletrônico oficial e em placa a ser afixada em local da obra de fácil visualização pelos cidadãos, aviso público de obra paralisada, com o motivo e o responsável pela inexecução temporária do objeto do contrato e a data prevista para o reinício da sua execução.\n\n§ 7º Os textos com as informações de que trata o\n\n§ 6º deste artigo deverão ser elaborados pela Administração.",
    capitulo: "TÍTULO III - CAPÍTULO II",
    secao: "Execução do Contrato"
  },
  "116": {
    numero: "116",
    ementa: "Art. 116º . Ao longo de toda a execução do contrato, o contratado deverá cumprir a reserva de cargos prevista em lei para pessoa com deficiência, para reabilitado da Previdência Social ou para aprendiz, bem como as reservas de cargos previstas em outras normas específicas. Parágrafo único. Sempre que solicitado pela Administração, o contratado deverá comprovar o cumprimento da reserva de cargos a que se refere o caput deste artigo, com a indicação dos empregados que preencherem as referidas vagas.",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "117": {
    numero: "117",
    ementa: "Art. 117º . A execução do contrato deverá ser acompanhada e fiscalizada por 1 (um) ou mais fiscais do contrato, representantes da Administração especialmente designados conforme requisitos estabelecidos no",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "118": {
    numero: "118",
    ementa: "Art. 118º . O contratado deverá manter preposto aceito pela Administração no local da obra ou do serviço para representá-lo na execução do contrato.",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "119": {
    numero: "119",
    ementa: "Art. 119º . O contratado será obrigado a reparar, corrigir, remover, reconstruir ou substituir, a suas expensas, no total ou em parte, o objeto do contrato em que se verificarem vícios, defeitos ou incorreções resultantes de sua execução ou de materiais nela empregados.",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "120": {
    numero: "120",
    ementa: "Art. 120º . O contratado será responsável pelos danos causados diretamente à Administração ou a terceiros em razão da execução do contrato, e não excluirá nem reduzirá essa responsabilidade a fiscalização ou o acompanhamento pelo contratante.",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "121": {
    numero: "121",
    ementa: "Art. 121º . Somente o contratado será responsável pelos encargos trabalhistas, previdenciários, fiscais e comerciais resultantes da execução do contrato.\n\n§ 1º A inadimplência do contratado em relação aos encargos trabalhistas, fiscais e comerciais não transferirá à Administração a responsabilidade pelo seu pagamento e não poderá onerar o objeto do contrato nem restringir a regularização e o uso das obras e das edificações, inclusive perante o registro de imóveis, ressalvada a hipótese prevista no\n\n§ 2º deste artigo.\n\n§ 2º Exclusivamente nas contratações de serviços contínuos com regime de dedicação exclusiva de mão de obra, a Administração responderá solidariamente pelos encargos previdenciários e subsidiariamente pelos encargos trabalhistas se comprovada falha na fiscalização do cumprimento das obrigações do contratado.\n\n§ 3º Nas contratações de serviços contínuos com regime de dedicação exclusiva de mão de obra, para assegurar o cumprimento de obrigações trabalhistas pelo contratado, a Administração, mediante disposição em edital ou em contrato, poderá, entre outras medidas:\n\nI - exigir caução, fiança bancária ou contratação de seguro-garantia com cobertura para verbas rescisórias inadimplidas;\n\nII - condicionar o pagamento à comprovação de quitação das obrigações trabalhistas vencidas relativas ao contrato;\n\nIII - efetuar o depósito de valores em conta vinculada;\n\nIV - em caso de inadimplemento, efetuar diretamente o pagamento das verbas trabalhistas, que serão deduzidas do pagamento devido ao contratado;\n\nV - estabelecer que os valores destinados a férias, a décimo terceiro salário, a ausências legais e a verbas rescisórias dos empregados do contratado que participarem da execução dos serviços contratados serão pagos pelo contratante ao contratado somente na ocorrência do fato gerador.\n\n§ 4º Os valores depositados na conta vinculada a que se refere o inciso III do\n\n§ 3º deste artigo são absolutamente impenhoráveis.\n\n§ 5º O recolhimento das contribuições previdenciárias observará o disposto no",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "122": {
    numero: "122",
    ementa: "Art. 122º . Na execução do contrato e sem prejuízo das responsabilidades contratuais e legais, o contratado poderá subcontratar partes da obra, do serviço ou do fornecimento até o limite autorizado, em cada caso, pela Administração.\n\n§ 1º O contratado apresentará à Administração documentação que comprove a capacidade técnica do subcontratado, que será avaliada e juntada aos autos do processo correspondente.\n\n§ 2º Regulamento ou edital de licitação poderão vedar, restringir ou estabelecer condições para a subcontratação.\n\n§ 3º Será vedada a subcontratação de pessoa física ou jurídica, se aquela ou os dirigentes desta mantiverem vínculo de natureza técnica, comercial, econômica, financeira, trabalhista ou civil com dirigente do órgão ou entidade contratante ou com agente público que desempenhe função na licitação ou atue na fiscalização ou na gestão do contrato, ou se deles forem cônjuge, companheiro ou parente em linha reta, colateral, ou por afinidade, até o terceiro grau, devendo essa proibição constar expressamente do edital de licitação.",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "123": {
    numero: "123",
    ementa: "Art. 123º . A Administração terá o dever de explicitamente emitir decisão sobre todas as solicitações e reclamações relacionadas à execução dos contratos regidos por esta Lei, ressalvados os requerimentos manifestamente impertinentes, meramente protelatórios ou de nenhum interesse para a boa execução do contrato. Parágrafo único. Salvo disposição legal ou cláusula contratual que estabeleça prazo específico, concluída a instrução do requerimento, a Administração terá o prazo de 1 (um) mês para decidir, admitida a prorrogação motivada por igual período. DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },

  // CAPÍTULO III - DAS ALTERAÇÕES DOS CONTRATOS (Arts. 124 a 136)
  "124": {
    numero: "124",
    ementa: "Art. 124º desta Lei;\n\nII - ao aumento ou à redução, por legislação superveniente, dos tributos diretamente pagos pelo contratado em decorrência do contrato.\n\n§ 6º Na alocação de que trata o caput deste artigo, poderão ser adotados métodos e padrões usualmente utilizados por entidades públicas e privadas, e os ministérios e secretarias supervisores dos órgãos e das entidades da Administração Pública poderão definir os parâmetros e o detalhamento dos procedimentos necessários a sua identificação, alocação e quantificação financeira. DAS PRERROGATIVAS DA ADMINISTRAÇÃO",
    capitulo: "TÍTULO III - CAPÍTULO III",
    secao: "Alterações Contratuais"
  },
  "125": {
    numero: "125",
    ementa: "Art. 125º . Nas alterações unilaterais a que se refere o inciso I do caput do",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "126": {
    numero: "126",
    ementa: "Art. 126º . As alterações unilaterais a que se refere o inciso I do caput do",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "127": {
    numero: "127",
    ementa: "Art. 127º . Se o contrato não contemplar preços unitários para obras ou serviços cujo aditamento se fizer necessário, esses serão fixados por meio da aplicação da relação geral entre os valores da proposta e o do orçamento-base da Administração sobre os preços referenciais ou de mercado vigentes na data do aditamento, respeitados os limites estabelecidos no",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "128": {
    numero: "128",
    ementa: "Art. 128º . Nas contratações de obras e serviços de engenharia, a diferença percentual entre o valor global do contrato e o preço global de referência não poderá ser reduzida em favor do contratado em decorrência de aditamentos que modifiquem a planilha orçamentária.",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "129": {
    numero: "129",
    ementa: "Art. 129º . Nas alterações contratuais para supressão de obras, bens ou serviços, se o contratado já houver adquirido os materiais e os colocado no local dos trabalhos, estes deverão ser pagos pela Administração pelos custos de aquisição regularmente comprovados e monetariamente reajustados, podendo caber indenização por outros danos eventualmente decorrentes da supressão, desde que regularmente comprovados.",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "130": {
    numero: "130",
    ementa: "Art. 130º . Caso haja alteração unilateral do contrato que aumente ou diminua os encargos do contratado, a Administração deverá restabelecer, no mesmo termo aditivo, o equilíbrio econômico-financeiro inicial.",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "131": {
    numero: "131",
    ementa: "Art. 131º . A extinção do contrato não configurará óbice para o reconhecimento do desequilíbrio econômico-financeiro, hipótese em que será concedida indenização por meio de termo indenizatório. Parágrafo único. O pedido de restabelecimento do equilíbrio econômico-financeiro deverá ser formulado durante a vigência do contrato e antes de eventual prorrogação nos termos do",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "132": {
    numero: "132",
    ementa: "Art. 132º . A formalização do termo aditivo é condição para a execução, pelo contratado, das prestações determinadas pela Administração no curso da execução do contrato, salvo nos casos de justificada necessidade de antecipação de seus efeitos, hipótese em que a formalização deverá ocorrer no prazo máximo de 1 (um) mês.",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "133": {
    numero: "133",
    ementa: "Art. 133º . Nas hipóteses em que for adotada a contratação integrada ou semi-integrada, é vedada a alteração dos valores contratuais, exceto nos seguintes casos:\n\nI - para restabelecimento do equilíbrio econômico-financeiro decorrente de caso fortuito ou força maior;\n\nII - por necessidade de alteração do projeto ou das especificações para melhor adequação técnica aos objetivos da contratação, a pedido da Administração, desde que não decorrente de erros ou omissões por parte do contratado, observados os limites estabelecidos no",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "134": {
    numero: "134",
    ementa: "Art. 134º . Os preços contratados serão alterados, para mais ou para menos, conforme o caso, se houver, após a data da apresentação da proposta, criação, alteração ou extinção de quaisquer tributos ou encargos legais ou a superveniência de disposições legais, com comprovada repercussão sobre os preços contratados.",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "135": {
    numero: "135",
    ementa: "Art. 135º desta Lei.\n\n§ 7º Para efeito do disposto nesta Lei, consideram-se como adimplemento da obrigação contratual a prestação do serviço, a realização da obra ou a entrega do bem, ou parcela destes, bem como qualquer outro evento contratual a cuja ocorrência esteja vinculada a emissão de documento de cobrança. (Incluído pela Lei nº 14.770, de 2023)",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "136": {
    numero: "136",
    ementa: "Art. 136º . Registros que não caracterizam alteração do contrato podem ser realizados por simples apostila, dispensada a celebração de termo aditivo, como nas seguintes situações:\n\nI - variação do valor contratual para fazer face ao reajuste ou à repactuação de preços previstos no próprio contrato;\n\nII - atualizações, compensações ou penalizações financeiras decorrentes das condições de pagamento previstas no contrato;\n\nIII - alterações na razão ou na denominação social do contratado;\n\nIV - empenho de dotações orçamentárias. DAS HIPÓTESES DE EXTINÇÃO DOS CONTRATOS",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },

  // CAPÍTULO IV - DO REEQUILÍBRIO ECONÔMICO-FINANCEIRO (Arts. 137 a 139)
  "137": {
    numero: "137",
    ementa: "Art. 137º . Constituirão motivos para extinção do contrato, a qual deverá ser formalmente motivada nos autos do processo, assegurados o contraditório e a ampla defesa, as seguintes situações:\n\nI - não cumprimento ou cumprimento irregular de normas editalícias ou de cláusulas contratuais, de especificações, de projetos ou de prazos;\n\nII - desatendimento das determinações regulares emitidas pela autoridade designada para acompanhar e fiscalizar sua execução ou por autoridade superior;\n\nIII - alteração social ou modificação da finalidade ou da estrutura da empresa que restrinja sua capacidade de concluir o contrato;\n\nIV - decretação de falência ou de insolvência civil, dissolução da sociedade ou falecimento do contratado;\n\nV - caso fortuito ou força maior, regularmente comprovados, impeditivos da execução do contrato;\n\nVI - atraso na obtenção da licença ambiental, ou impossibilidade de obtê-la, ou alteração substancial do anteprojeto que dela resultar, ainda que obtida no prazo previsto;\n\nVII - atraso na liberação das áreas sujeitas a desapropriação, a desocupação ou a servidão administrativa, ou impossibilidade de liberação dessas áreas;\n\nVIII - razões de interesse público, justificadas pela autoridade máxima do órgão ou da entidade contratante;\n\nIX - não cumprimento das obrigações relativas à reserva de cargos prevista em lei, bem como em outras normas específicas, para pessoa com deficiência, para reabilitado da Previdência Social ou para aprendiz.\n\n§ 1º Regulamento poderá especificar procedimentos e critérios para verificação da ocorrência dos motivos previstos no caput deste artigo.\n\n§ 2º O contratado terá direito à extinção do contrato nas seguintes hipóteses:\n\nI - supressão, por parte da Administração, de obras, serviços ou compras que acarrete modificação do valor inicial do contrato além do limite permitido no",
    capitulo: "TÍTULO III - CAPÍTULO IV",
    secao: "Reequilíbrio Econômico-Financeiro"
  },
  "138": {
    numero: "138",
    ementa: "Art. 138º . A extinção do contrato poderá ser:\n\nI - determinada por ato unilateral e escrito da Administração, exceto no caso de descumprimento decorrente de sua própria conduta;\n\nII - consensual, por acordo entre as partes, por conciliação, por mediação ou por comitê de resolução de disputas, desde que haja interesse da Administração;\n\nIII - determinada por decisão arbitral, em decorrência de cláusula compromissória ou compromisso arbitral, ou por decisão judicial.\n\n§ 1º A extinção determinada por ato unilateral da Administração e a extinção consensual deverão ser precedidas de autorização escrita e fundamentada da autoridade competente e reduzidas a termo no respectivo processo.\n\n§ 2º Quando a extinção decorrer de culpa exclusiva da Administração, o contratado será ressarcido pelos prejuízos regularmente comprovados que houver sofrido e terá direito a:\n\nI - devolução da garantia;\n\nII - pagamentos devidos pela execução do contrato até a data de extinção;\n\nIII - pagamento do custo da desmobilização.",
    capitulo: "TÍTULO III - CAPÍTULO IV"
  },
  "139": {
    numero: "139",
    ementa: "Art. 139º . A extinção determinada por ato unilateral da Administração poderá acarretar, sem prejuízo das sanções previstas nesta Lei, as seguintes consequências:\n\nI - assunção imediata do objeto do contrato, no estado e local em que se encontrar, por ato próprio da Administração;\n\nII - ocupação e utilização do local, das instalações, dos equipamentos, do material e do pessoal empregados na execução do contrato e necessários à sua continuidade;\n\nIII - execução da garantia contratual para:\n\na) ressarcimento da Administração Pública por prejuízos decorrentes da não execução;\n\nb) pagamento de verbas trabalhistas, fundiárias e previdenciárias, quando cabível;\n\nc) pagamento das multas devidas à Administração Pública;\n\nd) exigência da assunção da execução e da conclusão do objeto do contrato pela seguradora, quando cabível;\n\nIV - retenção dos créditos decorrentes do contrato até o limite dos prejuízos causados à Administração Pública e das multas aplicadas.\n\n§ 1º A aplicação das medidas previstas nos incisos I e II do caput deste artigo ficará a critério da Administração, que poderá dar continuidade à obra ou ao serviço por execução direta ou indireta.\n\n§ 2º Na hipótese do inciso II do caput deste artigo, o ato deverá ser precedido de autorização expressa do ministro de Estado, do secretário estadual ou do secretário municipal competente, conforme o caso. DO RECEBIMENTO DO OBJETO DO CONTRATO",
    capitulo: "TÍTULO III - CAPÍTULO IV"
  },

  // CAPÍTULO V - DOS PAGAMENTOS (Arts. 140 a 144)
  "140": {
    numero: "140",
    ementa: "Art. 140º . O objeto do contrato será recebido:\n\nI - em se tratando de obras e serviços:\n\na) provisoriamente, pelo responsável por seu acompanhamento e fiscalização, mediante termo detalhado, quando verificado o cumprimento das exigências de caráter técnico;\n\nb) definitivamente, por servidor ou comissão designada pela autoridade competente, mediante termo detalhado que comprove o atendimento das exigências contratuais;\n\nII - em se tratando de compras:\n\na) provisoriamente, de forma sumária, pelo responsável por seu acompanhamento e fiscalização, com verificação posterior da conformidade do material com as exigências contratuais;\n\nb) definitivamente, por servidor ou comissão designada pela autoridade competente, mediante termo detalhado que comprove o atendimento das exigências contratuais.\n\n§ 1º O objeto do contrato poderá ser rejeitado, no todo ou em parte, quando estiver em desacordo com o contrato.\n\n§ 2º O recebimento provisório ou definitivo não excluirá a responsabilidade civil pela solidez e pela segurança da obra ou serviço nem a responsabilidade ético-profissional pela perfeita execução do contrato, nos limites estabelecidos pela lei ou pelo contrato.\n\n§ 3º Os prazos e os métodos para a realização dos recebimentos provisório e definitivo serão definidos em regulamento ou no contrato.\n\n§ 4º Salvo disposição em contrário constante do edital ou de ato normativo, os ensaios, os testes e as demais provas para aferição da boa execução do objeto do contrato exigidos por normas técnicas oficiais correrão por conta do contratado.\n\n§ 5º Em se tratando de projeto de obra, o recebimento definitivo pela Administração não eximirá o projetista ou o consultor da responsabilidade objetiva por todos os danos causados por falha de projeto.\n\n§ 6º Em se tratando de obra, o recebimento definitivo pela Administração não eximirá o contratado, pelo prazo mínimo de 5 (cinco) anos, admitida a previsão de prazo de garantia superior no edital e no contrato, da responsabilidade objetiva pela solidez e pela segurança dos materiais e dos serviços executados e pela funcionalidade da construção, da reforma, da recuperação ou da ampliação do bem imóvel, e, em caso de vício, defeito ou incorreção identificados, o contratado ficará responsável pela reparação, pela correção, pela reconstrução ou pela substituição necessárias. DOS PAGAMENTOS",
    capitulo: "TÍTULO III - CAPÍTULO V",
    secao: "Pagamentos"
  },
  "141": {
    numero: "141",
    ementa: "Art. 141º . No dever de pagamento pela Administração, será observada a ordem cronológica para cada fonte diferenciada de recursos, subdividida nas seguintes categorias de contratos:\n\nI - fornecimento de bens;\n\nII - locações;\n\nIII - prestação de serviços;\n\nIV - realização de obras.\n\n§ 1º A ordem cronológica referida no caput deste artigo poderá ser alterada, mediante prévia justificativa da autoridade competente e posterior comunicação ao órgão de controle interno da Administração e ao tribunal de contas competente, exclusivamente nas seguintes situações:\n\nI - grave perturbação da ordem, situação de emergência ou calamidade pública;\n\nII - pagamento a microempresa, empresa de pequeno porte, agricultor familiar, produtor rural pessoa física, microempreendedor individual e sociedade cooperativa, desde que demonstrado o risco de descontinuidade do cumprimento do objeto do contrato;\n\nIII - pagamento de serviços necessários ao funcionamento dos sistemas estruturantes, desde que demonstrado o risco de descontinuidade do cumprimento do objeto do contrato;\n\nIV - pagamento de direitos oriundos de contratos em caso de falência, recuperação judicial ou dissolução da empresa contratada;\n\nV - pagamento de contrato cujo objeto seja imprescindível para assegurar a integridade do patrimônio público ou para manter o funcionamento das atividades finalísticas do órgão ou entidade, quando demonstrado o risco de descontinuidade da prestação de serviço público de relevância ou o cumprimento da missão institucional.\n\n§ 2º A inobservância imotivada da ordem cronológica referida no caput deste artigo ensejará a apuração de responsabilidade do agente responsável, cabendo aos órgãos de controle a sua fiscalização.\n\n§ 3º O órgão ou entidade deverá disponibilizar, mensalmente, em seção específica de acesso à informação em seu sítio na internet, a ordem cronológica de seus pagamentos, bem como as justificativas que fundamentarem a eventual alteração dessa ordem.",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "142": {
    numero: "142",
    ementa: "Art. 142º . Disposição expressa no edital ou no contrato poderá prever pagamento em conta vinculada ou pagamento pela efetiva comprovação do fato gerador. Parágrafo único. (VETADO).",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "143": {
    numero: "143",
    ementa: "Art. 143º . No caso de controvérsia sobre a execução do objeto, quanto a dimensão, qualidade e quantidade, a parcela incontroversa deverá ser liberada no prazo previsto para pagamento.",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "144": {
    numero: "144",
    ementa: "Art. 144º . Na contratação de obras, fornecimentos e serviços, inclusive de engenharia, poderá ser estabelecida remuneração variável vinculada ao desempenho do contratado, com base em metas, padrões de qualidade, critérios de sustentabilidade ambiental e prazos de entrega definidos no edital de licitação e no contrato.\n\n§ 1º O pagamento poderá ser ajustado em base percentual sobre o valor economizado em determinada despesa, quando o objeto do contrato visar à implantação de processo de racionalização, hipótese em que as despesas correrão à conta dos mesmos créditos orçamentários, na forma de regulamentação específica.\n\n§ 2º A utilização de remuneração variável será motivada e respeitará o limite orçamentário fixado pela Administração para a contratação.",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },

  // CAPÍTULO VI - DOS DIREITOS E OBRIGAÇÕES (Arts. 145 a 149)
  "145": {
    numero: "145",
    ementa: "Art. 145º . Não será permitido pagamento antecipado, parcial ou total, relativo a parcelas contratuais vinculadas ao fornecimento de bens, à execução de obras ou à prestação de serviços.\n\n§ 1º A antecipação de pagamento somente será permitida se propiciar sensível economia de recursos ou se representar condição indispensável para a obtenção do bem ou para a prestação do serviço, hipótese que deverá ser previamente justificada no processo licitatório e expressamente prevista no edital de licitação ou instrumento formal de contratação direta.\n\n§ 2º A Administração poderá exigir a prestação de garantia adicional como condição para o pagamento antecipado.\n\n§ 3º Caso o objeto não seja executado no prazo contratual, o valor antecipado deverá ser devolvido.",
    capitulo: "TÍTULO III - CAPÍTULO VI",
    secao: "Direitos e Obrigações"
  },
  "146": {
    numero: "146",
    ementa: "Art. 146º . No ato de liquidação da despesa, os serviços de contabilidade comunicarão aos órgãos da administração tributária as características da despesa e os valores pagos, conforme o disposto no",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "147": {
    numero: "147",
    ementa: "Art. 147º . Constatada irregularidade no procedimento licitatório ou na execução contratual, caso não seja possível o saneamento, a decisão sobre a suspensão da execução ou sobre a declaração de nulidade do contrato somente será adotada na hipótese em que se revelar medida de interesse público, com avaliação, entre outros, dos seguintes aspectos:\n\nI - impactos econômicos e financeiros decorrentes do atraso na fruição dos benefícios do objeto do contrato;\n\nII - riscos sociais, ambientais e à segurança da população local decorrentes do atraso na fruição dos benefícios do objeto do contrato;\n\nIII - motivação social e ambiental do contrato;\n\nIV - custo da deterioração ou da perda das parcelas executadas;\n\nV - despesa necessária à preservação das instalações e dos serviços já executados;\n\nVI - despesa inerente à desmobilização e ao posterior retorno às atividades;\n\nVII - medidas efetivamente adotadas pelo titular do órgão ou entidade para o saneamento dos indícios de irregularidades apontados;\n\nVIII - custo total e estágio de execução física e financeira dos contratos, dos convênios, das obras ou das parcelas envolvidas;\n\nIX - fechamento de postos de trabalho diretos e indiretos em razão da paralisação;\n\nX - custo para realização de nova licitação ou celebração de novo contrato;\n\nXI - custo de oportunidade do capital durante o período de paralisação. Parágrafo único. Caso a paralisação ou anulação não se revele medida de interesse público, o poder público deverá optar pela continuidade do contrato e pela solução da irregularidade por meio de indenização por perdas e danos, sem prejuízo da apuração de responsabilidade e da aplicação de penalidades cabíveis.",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "148": {
    numero: "148",
    ementa: "Art. 148º . A declaração de nulidade do contrato administrativo requererá análise prévia do interesse público envolvido, na forma do",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "149": {
    numero: "149",
    ementa: "Art. 149º . A nulidade não exonerará a Administração do dever de indenizar o contratado pelo que houver executado até a data em que for declarada ou tornada eficaz, bem como por outros prejuízos regularmente comprovados, desde que não lhe seja imputável, e será promovida a responsabilização de quem lhe tenha dado causa.",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },

  // CAPÍTULO VII - DA INTERVENÇÃO (Arts. 150 a 154)
  "150": {
    numero: "150",
    ementa: "Art. 150º . Nenhuma contratação será feita sem a caracterização adequada de seu objeto e sem a indicação dos créditos orçamentários para pagamento das parcelas contratuais vincendas no exercício em que for realizada a contratação, sob pena de nulidade do ato e de responsabilização de quem lhe tiver dado causa. DOS MEIOS ALTERNATIVOS DE RESOLUÇÃO DE CONTROVÉRSIAS",
    capitulo: "TÍTULO III - CAPÍTULO VII",
    secao: "Intervenção"
  },
  "151": {
    numero: "151",
    ementa: "Art. 151º . Nas contratações regidas por esta Lei, poderão ser utilizados meios alternativos de prevenção e resolução de controvérsias, notadamente a conciliação, a mediação, o comitê de resolução de disputas e a arbitragem. Parágrafo único. Será aplicado o disposto no caput deste artigo às controvérsias relacionadas a direitos patrimoniais disponíveis, como as questões relacionadas ao restabelecimento do equilíbrio econômico-financeiro do contrato, ao inadimplemento de obrigações contratuais por quaisquer das partes e ao cálculo de indenizações.",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "152": {
    numero: "152",
    ementa: "Art. 152º . A arbitragem será sempre de direito e observará o princípio da publicidade.",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "153": {
    numero: "153",
    ementa: "Art. 153º . Os contratos poderão ser aditados para permitir a adoção dos meios alternativos de resolução de controvérsias.",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "154": {
    numero: "154",
    ementa: "Art. 154º . O processo de escolha dos árbitros, dos colegiados arbitrais e dos comitês de resolução de disputas observará critérios isonômicos, técnicos e transparentes. DAS IRREGULARIDADES DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },

  // TÍTULO IV - DAS INFRAÇÕES E DAS SANÇÕES ADMINISTRATIVAS
  // CAPÍTULO I - DAS SANÇÕES ADMINISTRATIVAS (Arts. 155 a 159)
  "155": {
    numero: "155",
    ementa: "Art. 155º . O licitante ou o contratado será responsabilizado administrativamente pelas seguintes infrações:\n\nI - dar causa à inexecução parcial do contrato;\n\nII - dar causa à inexecução parcial do contrato que cause grave dano à Administração, ao funcionamento dos serviços públicos ou ao interesse coletivo;\n\nIII - dar causa à inexecução total do contrato;\n\nIV - deixar de entregar a documentação exigida para o certame;\n\nV - não manter a proposta, salvo em decorrência de fato superveniente devidamente justificado;\n\nVI - não celebrar o contrato ou não entregar a documentação exigida para a contratação, quando convocado dentro do prazo de validade de sua proposta;\n\nVII - ensejar o retardamento da execução ou da entrega do objeto da licitação sem motivo justificado;\n\nVIII - apresentar declaração ou documentação falsa exigida para o certame ou prestar declaração falsa durante a licitação ou a execução do contrato;\n\nIX - fraudar a licitação ou praticar ato fraudulento na execução do contrato;\n\nX - comportar-se de modo inidôneo ou cometer fraude de qualquer natureza;\n\nXI - praticar atos ilícitos com vistas a frustrar os objetivos da licitação;\n\nXII - praticar ato lesivo previsto no",
    capitulo: "TÍTULO IV - CAPÍTULO I",
    secao: "Sanções Administrativas"
  },
  "156": {
    numero: "156",
    ementa: "Art. 156º desta Lei em decorrência de orientação proposta, de prescrição técnica ou de qualquer ato profissional de sua responsabilidade.",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "157": {
    numero: "157",
    ementa: "Art. 157º . Na aplicação da sanção prevista no inciso II do caput do",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "158": {
    numero: "158",
    ementa: "Art. 158º . A aplicação das sanções previstas nos incisos III e IV do caput do",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "159": {
    numero: "159",
    ementa: "Art. 159º . Os atos previstos como infrações administrativas nesta Lei ou em outras leis de licitações e contratos da Administração Pública que também sejam tipificados como atos lesivos na Lei nº 12.846, de 1º de agosto de 2013, serão apurados e julgados conjuntamente, nos mesmos autos, observados o rito procedimental e a autoridade competente definidos na referida Lei. Parágrafo único. (VETADO).",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },

  // CAPÍTULO II - DO PROCESSO ADMINISTRATIVO SANCIONADOR (Arts. 160 a 162)
  "160": {
    numero: "160",
    ementa: "Art. 160º . A personalidade jurídica poderá ser desconsiderada sempre que utilizada com abuso do direito para facilitar, encobrir ou dissimular a prática dos atos ilícitos previstos nesta Lei ou para provocar confusão patrimonial, e, nesse caso, todos os efeitos das sanções aplicadas à pessoa jurídica serão estendidos aos seus administradores e sócios com poderes de administração, a pessoa jurídica sucessora ou a empresa do mesmo ramo com relação de coligação ou controle, de fato ou de direito, com o sancionado, observados, em todos os casos, o contraditório, a ampla defesa e a obrigatoriedade de análise jurídica prévia.",
    capitulo: "TÍTULO IV - CAPÍTULO II",
    secao: "Processo Sancionador"
  },
  "161": {
    numero: "161",
    ementa: "Art. 161º . Os órgãos e entidades dos Poderes Executivo, Legislativo e Judiciário de todos os entes federativos deverão, no prazo máximo 15 (quinze) dias úteis, contado da data de aplicação da sanção, informar e manter atualizados os dados relativos às sanções por eles aplicadas, para fins de publicidade no Cadastro Nacional de Empresas Inidôneas e Suspensas (Ceis) e no Cadastro Nacional de Empresas Punidas (Cnep), instituídos no âmbito do Poder Executivo federal. Parágrafo único. Para fins de aplicação das sanções previstas nos i ncisos I, II, III e IV do caput do",
    capitulo: "TÍTULO IV - CAPÍTULO II"
  },
  "162": {
    numero: "162",
    ementa: "Art. 162º . O atraso injustificado na execução do contrato sujeitará o contratado a multa de mora, na forma prevista em edital ou em contrato. Parágrafo único. A aplicação de multa de mora não impedirá que a Administração a converta em compensatória e promova a extinção unilateral do contrato com a aplicação cumulada de outras sanções previstas nesta Lei.",
    capitulo: "TÍTULO IV - CAPÍTULO II"
  },

  // CAPÍTULO III - DOS CRIMES E DAS INFRAÇÕES PENAIS (Arts. 163 a 173)
  "163": {
    numero: "163",
    ementa: "Art. 163º . É admitida a reabilitação do licitante ou contratado perante a própria autoridade que aplicou a penalidade, exigidos, cumulativamente:\n\nI - reparação integral do dano causado à Administração Pública;\n\nII - pagamento da multa;\n\nIII - transcurso do prazo mínimo de 1 (um) ano da aplicação da penalidade, no caso de impedimento de licitar e contratar, ou de 3 (três) anos da aplicação da penalidade, no caso de declaração de inidoneidade;\n\nIV - cumprimento das condições de reabilitação definidas no ato punitivo;\n\nV - análise jurídica prévia, com posicionamento conclusivo quanto ao cumprimento dos requisitos definidos neste artigo. Parágrafo único. A sanção pelas infrações previstas nos incisos VIII e XII do caput do",
    capitulo: "TÍTULO IV - CAPÍTULO III",
    secao: "Crimes e Infrações Penais"
  },
  "164": {
    numero: "164",
    ementa: "Art. 164º . Qualquer pessoa é parte legítima para impugnar edital de licitação por irregularidade na aplicação desta Lei ou para solicitar esclarecimento sobre os seus termos, devendo protocolar o pedido até 3 (três) dias úteis antes da data de abertura do certame. Parágrafo único. A resposta à impugnação ou ao pedido de esclarecimento será divulgada em sítio eletrônico oficial no prazo de até 3 (três) dias úteis, limitado ao último dia útil anterior à data da abertura do certame.",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "165": {
    numero: "165",
    ementa: "Art. 165º . Dos atos da Administração decorrentes da aplicação desta Lei cabem:\n\nI - recurso, no prazo de 3 (três) dias úteis, contado da data de intimação ou de lavratura da ata, em face de:\n\na) ato que defira ou indefira pedido de pré-qualificação de interessado ou de inscrição em registro cadastral, sua alteração ou cancelamento;\n\nb) julgamento das propostas;\n\nc) ato de habilitação ou inabilitação de licitante;\n\nd) anulação ou revogação da licitação;\n\ne) extinção do contrato, quando determinada por ato unilateral e escrito da Administração;\n\nII - pedido de reconsideração, no prazo de 3 (três) dias úteis, contado da data de intimação, relativamente a ato do qual não caiba recurso hierárquico.\n\n§ 1º Quanto ao recurso apresentado em virtude do disposto nas alíneas b e c do inciso I do caput deste artigo, serão observadas as seguintes disposições:\n\nI - a intenção de recorrer deverá ser manifestada imediatamente, sob pena de preclusão, e o prazo para apresentação das razões recursais previsto no inciso I do caput deste artigo será iniciado na data de intimação ou de lavratura da ata de habilitação ou inabilitação ou, na hipótese de adoção da inversão de fases prevista no\n\n§ 1º do",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "166": {
    numero: "166",
    ementa: "Art. 166º . Da aplicação das sanções previstas nos incisos I, II e III do caput do",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "167": {
    numero: "167",
    ementa: "Art. 167º . Da aplicação da sanção prevista no inciso IV do caput do",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "168": {
    numero: "168",
    ementa: "Art. 168º . O recurso e o pedido de reconsideração terão efeito suspensivo do ato ou da decisão recorrida até que sobrevenha decisão final da autoridade competente. Parágrafo único. Na elaboração de suas decisões, a autoridade competente será auxiliada pelo órgão de assessoramento jurídico, que deverá dirimir dúvidas e subsidiá-la com as informações necessárias. DO CONTROLE DAS CONTRATAÇÕES",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "169": {
    numero: "169",
    ementa: "Art. 169º . As contratações públicas deverão submeter-se a práticas contínuas e permanentes de gestão de riscos e de controle preventivo, inclusive mediante adoção de recursos de tecnologia da informação, e, além de estar subordinadas ao controle social, sujeitar-se-ão às seguintes linhas de defesa:\n\nI - primeira linha de defesa, integrada por servidores e empregados públicos, agentes de licitação e autoridades que atuam na estrutura de governança do órgão ou entidade;\n\nII - segunda linha de defesa, integrada pelas unidades de assessoramento jurídico e de controle interno do próprio órgão ou entidade;\n\nIII - terceira linha de defesa, integrada pelo órgão central de controle interno da Administração e pelo tribunal de contas.\n\n§ 1º Na forma de regulamento, a implementação das práticas a que se refere o caput deste artigo será de responsabilidade da alta administração do órgão ou entidade e levará em consideração os custos e os benefícios decorrentes de sua implementação, optando-se pelas medidas que promovam relações íntegras e confiáveis, com segurança jurídica para todos os envolvidos, e que produzam o resultado mais vantajoso para a Administração, com eficiência, eficácia e efetividade nas contratações públicas.\n\n§ 2º Para a realização de suas atividades, os órgãos de controle deverão ter acesso irrestrito aos documentos e às informações necessárias à realização dos trabalhos, inclusive aos documentos classificados pelo órgão ou entidade nos termos da Lei nº 12.527, de 18 de novembro de 2011, e o órgão de controle com o qual foi compartilhada eventual informação sigilosa tornar-se-á corresponsável pela manutenção do seu sigilo.\n\n§ 3º Os integrantes das linhas de defesa a que se referem os incisos I, II e III do caput deste artigo observarão o seguinte:\n\nI - quando constatarem simples impropriedade formal, adotarão medidas para o seu saneamento e para a mitigação de riscos de sua nova ocorrência, preferencialmente com o aperfeiçoamento dos controles preventivos e com a capacitação dos agentes públicos responsáveis;\n\nII - quando constatarem irregularidade que configure dano à Administração, sem prejuízo das medidas previstas no inciso I deste § 3º, adotarão as providências necessárias para a apuração das infrações administrativas, observadas a segregação de funções e a necessidade de individualização das condutas, bem como remeterão ao Ministério Público competente cópias dos documentos cabíveis para a apuração dos ilícitos de sua competência.",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "170": {
    numero: "170",
    ementa: "Art. 170º . Os órgãos de controle adotarão, na fiscalização dos atos previstos nesta Lei, critérios de oportunidade, materialidade, relevância e risco e considerarão as razões apresentadas pelos órgãos e entidades responsáveis e os resultados obtidos com a contratação, observado o disposto no\n\n§ 3º do",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "171": {
    numero: "171",
    ementa: "Art. 171º . Na fiscalização de controle será observado o seguinte:\n\nI - viabilização de oportunidade de manifestação aos gestores sobre possíveis propostas de encaminhamento que terão impacto significativo nas rotinas de trabalho dos órgãos e entidades fiscalizados, a fim de que eles disponibilizem subsídios para avaliação prévia da relação entre custo e benefício dessas possíveis proposições;\n\nII - adoção de procedimentos objetivos e imparciais e elaboração de relatórios tecnicamente fundamentados, baseados exclusivamente nas evidências obtidas e organizados de acordo com as normas de auditoria do respectivo órgão de controle, de modo a evitar que interesses pessoais e interpretações tendenciosas interfiram na apresentação e no tratamento dos fatos levantados;\n\nIII - definição de objetivos, nos regimes de empreitada por preço global, empreitada integral, contratação semi-integrada e contratação integrada, atendidos os requisitos técnicos, legais, orçamentários e financeiros, de acordo com as finalidades da contratação, devendo, ainda, ser perquirida a conformidade do preço global com os parâmetros de mercado para o objeto contratado, considerada inclusive a dimensão geográfica.\n\n§ 1º Ao suspender cautelarmente o processo licitatório, o tribunal de contas deverá pronunciar-se definitivamente sobre o mérito da irregularidade que tenha dado causa à suspensão no prazo de 25 (vinte e cinco) dias úteis, contado da data do recebimento das informações a que se refere o\n\n§ 2º deste artigo, prorrogável por igual período uma única vez, e definirá objetivamente:\n\nI - as causas da ordem de suspensão;\n\nII - o modo como será garantido o atendimento do interesse público obstado pela suspensão da licitação, no caso de objetos essenciais ou de contratação por emergência.\n\n§ 2º Ao ser intimado da ordem de suspensão do processo licitatório, o órgão ou entidade deverá, no prazo de 10 (dez) dias úteis, admitida a prorrogação:\n\nI - informar as medidas adotadas para cumprimento da decisão;\n\nII - prestar todas as informações cabíveis;\n\nIII - proceder à apuração de responsabilidade, se for o caso.\n\n§ 3º A decisão que examinar o mérito da medida cautelar a que se refere o\n\n§ 1º deste artigo deverá definir as medidas necessárias e adequadas, em face das alternativas possíveis, para o saneamento do processo licitatório, ou determinar a sua anulação.\n\n§ 4º O descumprimento do disposto no\n\n§ 2º deste artigo ensejará a apuração de responsabilidade e a obrigação de reparação do prejuízo causado ao erário.",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "172": {
    numero: "172",
    ementa: "Art. 172º . (VETADO).",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "173": {
    numero: "173",
    ementa: "Art. 173º . Os tribunais de contas deverão, por meio de suas escolas de contas, promover eventos de capacitação para os servidores efetivos e empregados públicos designados para o desempenho das funções essenciais à execução desta Lei, incluídos cursos presenciais e a distância, redes de aprendizagem, seminários e congressos sobre contratações públicas. DISPOSIÇÕES GERAIS DO PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS (PNCP)",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },

  // TÍTULO V - DOS INSTRUMENTOS AUXILIARES
  "174": {
    numero: "174",
    ementa: "Art. 174º . É criado o Portal Nacional de Contratações Públicas (PNCP), sítio eletrônico oficial destinado à:\n\nI - divulgação centralizada e obrigatória dos atos exigidos por esta Lei;\n\nII - realização facultativa das contratações pelos órgãos e entidades dos Poderes Executivo, Legislativo e Judiciário de todos os entes federativos.\n\n§ 1º O PNCP será gerido pelo Comitê Gestor da Rede Nacional de Contratações Públicas, a ser presidido por representante indicado pelo Presidente da República e composto de:\n\nI - 3 (três) representantes da União indicados pelo Presidente da República;\n\nII - 2 (dois) representantes dos Estados e do Distrito Federal indicados pelo Conselho Nacional de Secretários de Estado da Administração;\n\nIII - 2 (dois) representantes dos Municípios indicados pela Confederação Nacional de Municípios.\n\n§ 2º O PNCP conterá, entre outras, as seguintes informações acerca das contratações:\n\nI - planos de contratação anuais;\n\nII - catálogos eletrônicos de padronização;\n\nIII - editais de credenciamento e de pré-qualificação, avisos de contratação direta e editais de licitação e respectivos anexos;\n\nIV - atas de registro de preços;\n\nV - contratos e termos aditivos;\n\nVI - notas fiscais eletrônicas, quando for o caso.\n\n§ 3º O PNCP deverá, entre outras funcionalidades, oferecer:\n\nI - sistema de registro cadastral unificado;\n\nII - painel para consulta de preços, banco de preços em saúde e acesso à base nacional de notas fiscais eletrônicas;\n\nIII - sistema de planejamento e gerenciamento de contratações, incluído o cadastro de atesto de cumprimento de obrigações previsto no\n\n§ 4º do",
    capitulo: "TÍTULO V",
    secao: "Instrumentos Auxiliares"
  },
  "175": {
    numero: "175",
    ementa: "Art. 175º . Sem prejuízo do disposto no",
    capitulo: "TÍTULO V"
  },
  "176": {
    numero: "176",
    ementa: "Art. 176º . Os Municípios com até 20.000 (vinte mil) habitantes terão o prazo de 6 (seis) anos, contado da data de publicação desta Lei, para cumprimento:\n\nI - dos requisitos estabelecidos no",
    capitulo: "TÍTULO V"
  },
  "177": {
    numero: "177",
    ementa: "Art. 177º O caput do art. 1.048 da Lei nº 13.105, de 16 de março de 2015 (Código de Processo Civil), passa a vigorar acrescido do seguinte inciso IV:\n\n\"Art. 1.048. [...]\n\nIV - impugnação à aplicação de penalidade decorrente de infração de norma de licitação ou contratação administrativa, bem como contra ato de rescisão contratual unilateral realizado pela Administração Pública contratante.\"",
    capitulo: "TÍTULO V"
  },
  "178": {
    numero: "178",
    ementa: "Art. 178º desta Lei.\n\n§ 2º As contratações realizadas no âmbito das repartições públicas sediadas no exterior obedecerão às peculiaridades locais e aos princípios básicos estabelecidos nesta Lei, na forma de regulamentação específica a ser editada por ministro de Estado.\n\n§ 3º Nas licitações e contratações que envolvam recursos provenientes de empréstimo ou doação oriundos de agência oficial de cooperação estrangeira ou de organismo financeiro de que o Brasil seja parte, podem ser admitidas:\n\nI - condições decorrentes de acordos internacionais aprovados pelo Congresso Nacional e ratificados pelo Presidente da República;\n\nII - condições peculiares à seleção e à contratação constantes de normas e procedimentos das agências ou dos organismos, desde que:\n\na) sejam exigidas para a obtenção do empréstimo ou doação;\n\nb) não conflitem com os princípios constitucionais em vigor;\n\nc) sejam indicadas no respectivo contrato de empréstimo ou doação e tenham sido objeto de parecer favorável do órgão jurídico do contratante do financiamento previamente à celebração do referido contrato;\n\nd) (VETADO).\n\n§ 4º A documentação encaminhada ao Senado Federal para autorização do empréstimo de que trata o\n\n§ 3º deste artigo deverá fazer referência às condições contratuais que incidam na hipótese do referido parágrafo.\n\n§ 5º As contratações relativas à gestão, direta e indireta, das reservas internacionais do País, inclusive as de serviços conexos ou acessórios a essa atividade, serão disciplinadas em ato normativo próprio do Banco Central do Brasil, assegurada a observância dos princípios estabelecidos no caput do",
    capitulo: "TÍTULO V"
  },
  "179": {
    numero: "179",
    ementa: "Art. 179º . Os incisos II e III do caput do",
    capitulo: "TÍTULO V"
  },

  // TÍTULO VI - DA CONTRATAÇÃO DE SERVIÇOS TERCEIRIZADOS
  "180": {
    numero: "180",
    ementa: "Art. 180º O caput do art. 10 da Lei nº 11.079, de 30 de dezembro de 2004, passa a vigorar com a seguinte redação:\n\n\"Art. 10. A contratação de parceria público-privada será precedida de licitação na modalidade concorrência ou diálogo competitivo, conforme regulamento, em que se observe, em especial, o seguinte: [...]\"",
    capitulo: "TÍTULO VI",
    secao: "Terceirização"
  },
  "181": {
    numero: "181",
    ementa: "Art. 181º . Os entes federativos instituirão centrais de compras, com o objetivo de realizar compras em grande escala, para atender a diversos órgãos e entidades sob sua competência e atingir as finalidades desta Lei. Parágrafo único. No caso dos Municípios com até 10.000 (dez mil) habitantes, serão preferencialmente constituídos consórcios públicos para a realização das atividades previstas no caput deste artigo, nos termos da Lei nº 11.107, de 6 de abril de 2005.",
    capitulo: "TÍTULO VI"
  },

  // TÍTULO VII - DISPOSIÇÕES TRANSITÓRIAS E FINAIS (Arts. 182 a 193)
  "182": {
    numero: "182",
    ementa: "Art. 182º . O Poder Executivo federal atualizará, a cada dia 1º de janeiro, pelo Índice Nacional de Preços ao Consumidor Amplo Especial (IPCA-E) ou por índice que venha a substituí-lo, os valores fixados por esta Lei, os quais serão divulgados no PNCP.",
    capitulo: "TÍTULO VII",
    secao: "Disposições Transitórias"
  },
  "183": {
    numero: "183",
    ementa: "Art. 183º . Os prazos previstos nesta Lei serão contados com exclusão do dia do começo e inclusão do dia do vencimento e observarão as seguintes disposições:\n\nI - os prazos expressos em dias corridos serão computados de modo contínuo;\n\nII - os prazos expressos em meses ou anos serão computados de data a data;\n\nIII - nos prazos expressos em dias úteis, serão computados somente os dias em que ocorrer expediente administrativo no órgão ou entidade competente.\n\n§ 1º Salvo disposição em contrário, considera-se dia do começo do prazo:\n\nI - o primeiro dia útil seguinte ao da disponibilização da informação na internet;\n\nII - a data de juntada aos autos do aviso de recebimento, quando a notificação for pelos correios.\n\n§ 2º Considera-se prorrogado o prazo até o primeiro dia útil seguinte se o vencimento cair em dia em que não houver expediente, se o expediente for encerrado antes da hora normal ou se houver indisponibilidade da comunicação eletrônica.\n\n§ 3º Na hipótese do inciso II do caput deste artigo, se no mês do vencimento não houver o dia equivalente àquele do início do prazo, considera-se como termo o último dia do mês.",
    capitulo: "TÍTULO VII"
  },
  "184": {
    numero: "184",
    ementa: "Art. 184º . Aplicam-se as disposições desta Lei, no que couber e na ausência de norma específica, aos convênios, acordos, ajustes e outros instrumentos congêneres celebrados por órgãos e entidades da Administração Pública, na forma estabelecida em regulamento do Poder Executivo federal.\n\n§ 1º (VETADO). (Incluído pela Lei nº 14.770, de 2023)\n\n§ 2º Quando, verificada qualquer das hipóteses da alínea d do inciso II do caput do",
    capitulo: "TÍTULO VII"
  },
  "185": {
    numero: "185",
    ementa: "Art. 185º . Aplicam-se às licitações e aos contratos regidos pela Lei nº 13.303, de 30 de junho de 2016, as disposições do Capítulo\n\nII - B do Título XI da Parte Especial do Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal).",
    capitulo: "TÍTULO VII"
  },
  "186": {
    numero: "186",
    ementa: "Art. 186º . Aplicam-se as disposições desta Lei subsidiariamente à Lei nº 8.987, de 13 de fevereiro de 1995, à Lei nº 11.079, de 30 de dezembro de 2004, e à Lei nº 12.232, de 29 de abril de 2010.",
    capitulo: "TÍTULO VII"
  },
  "187": {
    numero: "187",
    ementa: "Art. 187º . Os Estados, o Distrito Federal e os Municípios poderão aplicar os regulamentos editados pela União para execução desta Lei.",
    capitulo: "TÍTULO VII"
  },
  "188": {
    numero: "188",
    ementa: "Art. 188º . (VETADO).",
    capitulo: "TÍTULO VII"
  },
  "189": {
    numero: "189",
    ementa: "Art. 189º . Aplica-se esta Lei às hipóteses previstas na legislação que façam referência expressa à Lei nº 8.666, de 21 de junho de 1993, à Lei nº 10.520, de 17 de julho de 2002, e aos arts. 1º a 47-A da Lei nº 12.462, de 4 de agosto de 2011.",
    capitulo: "TÍTULO VII"
  },
  "190": {
    numero: "190",
    ementa: "Art. 190º . O contrato cujo instrumento tenha sido assinado antes da entrada em vigor desta Lei continuará a ser regido de acordo com as regras previstas na legislação revogada.",
    capitulo: "TÍTULO VII"
  },
  "191": {
    numero: "191",
    ementa: "Art. 191º . Até o decurso do prazo de que trata o inciso II do caput do",
    capitulo: "TÍTULO VII",
    secao: "Disposições Finais"
  },
  "192": {
    numero: "192",
    ementa: "Art. 192º . O contrato relativo a imóvel do patrimônio da União ou de suas autarquias e fundações continuará regido pela legislação pertinente, aplicada esta Lei subsidiariamente.",
    capitulo: "TÍTULO VII"
  },
  "193": {
    numero: "193",
    ementa: "Art. 193º , a Administração poderá optar por licitar ou contratar diretamente de acordo com esta Lei ou de acordo com as leis citadas no referido inciso, e a opção escolhida deverá ser indicada expressamente no edital ou no aviso ou instrumento de contratação direta, vedada a aplicação combinada desta Lei com as citadas no referido inciso. Parágrafo único. Na hipótese do caput deste artigo, se a Administração optar por licitar de acordo com as leis citadas no inciso II do caput do",
    capitulo: "TÍTULO VII"
  },
};

// Array com todos os números de artigos (1-193)
export const LEI_14133_ARTIGOS_ARRAY = Array.from(
  { length: 193 },
  (_, i) => (i + 1).toString()
);

// Função para obter artigo por número
export function getLeiArticle(numero: string): LeiArticle | undefined {
  return LEI_14133_ARTIGOS[numero];
}

// Função para buscar artigos por texto
export function searchLeiArticles(searchTerm: string): LeiArticle[] {
  const term = searchTerm.toLowerCase();
  return Object.values(LEI_14133_ARTIGOS).filter(
    art =>
      art.numero.includes(term) ||
      art.ementa.toLowerCase().includes(term) ||
      art.capitulo.toLowerCase().includes(term) ||
      art.secao?.toLowerCase().includes(term)
  );
}

// Agrupar artigos por capítulo
export function getArticlesByCapitulo(): Record<string, LeiArticle[]> {
  const grouped: Record<string, LeiArticle[]> = {};

  Object.values(LEI_14133_ARTIGOS).forEach(article => {
    if (!grouped[article.capitulo]) {
      grouped[article.capitulo] = [];
    }
    grouped[article.capitulo].push(article);
  });

  return grouped;
}

// Sugestões de artigos populares (mais usados em concursos e prática)
export const ARTIGOS_POPULARES = [
  "5",   // Princípios (CORRIGIDO!)
  "6",   // Definições (CORRIGIDO!)
  "8",   // Agente de contratação
  "12",  // Impedimentos
  "18",  // Objeto da licitação
  "22",  // Planejamento
  "29",  // Modalidades
  "30",  // Pregão
  "72",  // Inexigibilidade
  "74",  // Dispensa
  "75",  // Hipóteses de dispensa
  "124", // Alterações contratuais
  "137", // Reequilíbrio
  "155", // Sanções
  "160", // Processo sancionador
  "191", // PNCP
];

// Formatação para exibição
export function formatArticleNumber(numero: string): string {
  return `Art. ${numero}º`;
}

export function formatArticleTitle(article: LeiArticle): string {
  return `${formatArticleNumber(article.numero)} - ${article.ementa}`;
}
