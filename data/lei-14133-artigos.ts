/**
 * Lei 14.133/2021 - Nova Lei de Licitações e Contratos Administrativos
 * Referência completa dos 193 artigos para catalogação de materiais
 */

export interface LeiArticle {
  numero: string;
  ementa: string;
  capitulo: string;
  secao?: string;
}

export const LEI_14133_ARTIGOS: Record<string, LeiArticle> = {
  // TÍTULO I - DISPOSIÇÕES GERAIS
  // CAPÍTULO I - DAS DISPOSIÇÕES PRELIMINARES
  "1": {
    numero: "1",
    ementa: "Normas gerais de licitação e contratação para as Administrações Públicas",
    capitulo: "TÍTULO I - CAPÍTULO I",
    secao: "Disposições Preliminares"
  },
  "2": {
    numero: "2",
    ementa: "Aplicação subsidiária da Lei nº 8.666/1993",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "3": {
    numero: "3",
    ementa: "Conceitos e definições",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "4": {
    numero: "4",
    ementa: "Processo de licitação",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "5": {
    numero: "5",
    ementa: "Finalidades da licitação",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },

  // CAPÍTULO II - DOS PRINCÍPIOS
  "6": {
    numero: "6",
    ementa: "Princípios da licitação: legalidade, impessoalidade, moralidade, publicidade, eficiência, interesse público, probidade administrativa, igualdade, planejamento, transparência, eficácia, segregação de funções, motivação, vinculação ao edital, julgamento objetivo, segurança jurídica, razoabilidade, competitividade, proporcionalidade, celeridade, economicidade e desenvolvimento nacional sustentável",
    capitulo: "TÍTULO I - CAPÍTULO II",
    secao: "Princípios"
  },

  // CAPÍTULO III - DOS AGENTES PÚBLICOS
  "7": {
    numero: "7",
    ementa: "Agentes públicos que atuam em licitações e contratos",
    capitulo: "TÍTULO I - CAPÍTULO III",
    secao: "Agentes Públicos"
  },
  "8": {
    numero: "8",
    ementa: "Agente de contratação",
    capitulo: "TÍTULO I - CAPÍTULO III"
  },
  "9": {
    numero: "9",
    ementa: "Comissão de contratação",
    capitulo: "TÍTULO I - CAPÍTULO III"
  },
  "10": {
    numero: "10",
    ementa: "Equipe de apoio",
    capitulo: "TÍTULO I - CAPÍTULO III"
  },
  "11": {
    numero: "11",
    ementa: "Requisitos para ser agente de contratação ou membro de comissão",
    capitulo: "TÍTULO I - CAPÍTULO III"
  },
  "12": {
    numero: "12",
    ementa: "Impedimentos e suspeição",
    capitulo: "TÍTULO I - CAPÍTULO III"
  },
  "13": {
    numero: "13",
    ementa: "Responsabilidade dos agentes públicos",
    capitulo: "TÍTULO I - CAPÍTULO III"
  },

  // CAPÍTULO IV - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE
  "14": {
    numero: "14",
    ementa: "Órgãos de assessoramento jurídico e controle interno",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Órgãos de Assessoramento e Controle"
  },
  "15": {
    numero: "15",
    ementa: "Atuação prévia e concomitante dos órgãos de controle",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "16": {
    numero: "16",
    ementa: "Vedações aos órgãos de controle",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "17": {
    numero: "17",
    ementa: "Responsabilidade dos membros dos órgãos de controle",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },

  // TÍTULO II - DAS LICITAÇÕES
  // CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES
  "18": {
    numero: "18",
    ementa: "Objeto da licitação",
    capitulo: "TÍTULO II - CAPÍTULO I",
    secao: "Regras Gerais"
  },
  "19": {
    numero: "19",
    ementa: "Processo administrativo de licitação",
    capitulo: "TÍTULO II - CAPÍTULO I"
  },
  "20": {
    numero: "20",
    ementa: "Fases da licitação",
    capitulo: "TÍTULO II - CAPÍTULO I"
  },
  "21": {
    numero: "21",
    ementa: "Procedimentos auxiliares: pré-qualificação permanente, registro cadastral e registro de preços",
    capitulo: "TÍTULO II - CAPÍTULO I"
  },

  // SEÇÃO I - DO PLANEJAMENTO DA CONTRATAÇÃO
  "22": {
    numero: "22",
    ementa: "Plano de contratações anual",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I",
    secao: "Planejamento da Contratação"
  },
  "23": {
    numero: "23",
    ementa: "Estudos técnicos preliminares",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I"
  },
  "24": {
    numero: "24",
    ementa: "Gestão de riscos",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I"
  },
  "25": {
    numero: "25",
    ementa: "Análise de viabilidade da contratação",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I"
  },

  // SEÇÃO II - DO EDITAL E ANTEPROJETO
  "26": {
    numero: "26",
    ementa: "Anteprojeto",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II",
    secao: "Edital e Anteprojeto"
  },
  "27": {
    numero: "27",
    ementa: "Projetos básico e executivo",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },
  "28": {
    numero: "28",
    ementa: "Responsabilidade técnica dos projetos",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },

  // Continuando com os artigos principais mais relevantes...
  "29": {
    numero: "29",
    ementa: "Modalidades de licitação",
    capitulo: "TÍTULO II - CAPÍTULO II",
    secao: "Modalidades de Licitação"
  },

  // MODALIDADES
  "30": {
    numero: "30",
    ementa: "Pregão",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "31": {
    numero: "31",
    ementa: "Concorrência",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "32": {
    numero: "32",
    ementa: "Concurso",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "33": {
    numero: "33",
    ementa: "Leilão",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "34": {
    numero: "34",
    ementa: "Diálogo competitivo",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },

  // CRITÉRIOS DE JULGAMENTO
  "35": {
    numero: "35",
    ementa: "Critérios de julgamento",
    capitulo: "TÍTULO II - CAPÍTULO III",
    secao: "Critérios de Julgamento"
  },
  "36": {
    numero: "36",
    ementa: "Menor preço ou maior desconto",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "37": {
    numero: "37",
    ementa: "Maior lance ou oferta",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "38": {
    numero: "38",
    ementa: "Melhor técnica ou conteúdo artístico",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "39": {
    numero: "39",
    ementa: "Técnica e preço",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "40": {
    numero: "40",
    ementa: "Maior retorno econômico",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },

  // PROCEDIMENTO DA LICITAÇÃO
  "41": {
    numero: "41",
    ementa: "Fases do procedimento",
    capitulo: "TÍTULO II - CAPÍTULO IV",
    secao: "Procedimento da Licitação"
  },
  "42": {
    numero: "42",
    ementa: "Divulgação do edital",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "43": {
    numero: "43",
    ementa: "Prazos mínimos para apresentação de propostas",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "44": {
    numero: "44",
    ementa: "Impugnação ao edital",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "45": {
    numero: "45",
    ementa: "Pedido de esclarecimento",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "46": {
    numero: "46",
    ementa: "Modificação do edital",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "47": {
    numero: "47",
    ementa: "Apresentação de propostas e lances",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "48": {
    numero: "48",
    ementa: "Propostas em envelope fechado ou sistema eletrônico",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "49": {
    numero: "49",
    ementa: "Envelope de habilitação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "50": {
    numero: "50",
    ementa: "Abertura de envelopes",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "51": {
    numero: "51",
    ementa: "Julgamento das propostas",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "52": {
    numero: "52",
    ementa: "Classificação das propostas",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "53": {
    numero: "53",
    ementa: "Desclassificação de propostas",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "54": {
    numero: "54",
    ementa: "Habilitação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "55": {
    numero: "55",
    ementa: "Documentos de habilitação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "56": {
    numero: "56",
    ementa: "Habilitação jurídica",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "57": {
    numero: "57",
    ementa: "Regularidade fiscal e trabalhista",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "58": {
    numero: "58",
    ementa: "Qualificação técnica",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "59": {
    numero: "59",
    ementa: "Qualificação econômico-financeira",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "60": {
    numero: "60",
    ementa: "Inabilitação e recurso",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "61": {
    numero: "61",
    ementa: "Convocação de licitante remanescente",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "62": {
    numero: "62",
    ementa: "Negociação de preços",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "63": {
    numero: "63",
    ementa: "Adjudicação e homologação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "64": {
    numero: "64",
    ementa: "Recursos administrativos",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "65": {
    numero: "65",
    ementa: "Prazo para recurso",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "66": {
    numero: "66",
    ementa: "Efeito suspensivo",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "67": {
    numero: "67",
    ementa: "Anulação e revogação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "68": {
    numero: "68",
    ementa: "Motivos de anulação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "69": {
    numero: "69",
    ementa: "Motivos de revogação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "70": {
    numero: "70",
    ementa: "Efeitos da anulação e revogação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "71": {
    numero: "71",
    ementa: "Vedação à subcontratação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },

  // CONTRATAÇÃO DIRETA
  "72": {
    numero: "72",
    ementa: "Inexigibilidade de licitação",
    capitulo: "TÍTULO II - CAPÍTULO V",
    secao: "Contratação Direta"
  },
  "73": {
    numero: "73",
    ementa: "Hipóteses de inexigibilidade",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "74": {
    numero: "74",
    ementa: "Dispensa de licitação",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "75": {
    numero: "75",
    ementa: "Hipóteses de dispensa",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "76": {
    numero: "76",
    ementa: "Vedações na dispensa e inexigibilidade",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "77": {
    numero: "77",
    ementa: "Procedimento de contratação direta",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "78": {
    numero: "78",
    ementa: "Justificativa de preço",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "79": {
    numero: "79",
    ementa: "Aviso de contratação direta",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "80": {
    numero: "80",
    ementa: "Ratificação e autorização",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },

  // SISTEMA DE REGISTRO DE PREÇOS
  "81": {
    numero: "81",
    ementa: "Sistema de Registro de Preços (SRP)",
    capitulo: "TÍTULO II - CAPÍTULO VI",
    secao: "Sistema de Registro de Preços"
  },
  "82": {
    numero: "82",
    ementa: "Ata de registro de preços",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "83": {
    numero: "83",
    ementa: "Vigência da ata",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "84": {
    numero: "84",
    ementa: "Adesão à ata (carona)",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "85": {
    numero: "85",
    ementa: "Cancelamento do registro",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "86": {
    numero: "86",
    ementa: "Controle e atualização de preços",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },

  // PRÉ-QUALIFICAÇÃO E CADASTRO
  "87": {
    numero: "87",
    ementa: "Pré-qualificação permanente",
    capitulo: "TÍTULO II - CAPÍTULO VII",
    secao: "Pré-qualificação e Cadastro"
  },
  "88": {
    numero: "88",
    ementa: "Registro cadastral",
    capitulo: "TÍTULO II - CAPÍTULO VII"
  },

  // CONTRATOS
  "89": {
    numero: "89",
    ementa: "Formalização dos contratos",
    capitulo: "TÍTULO III - CAPÍTULO I",
    secao: "Dos Contratos"
  },
  "90": {
    numero: "90",
    ementa: "Cláusulas necessárias",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "91": {
    numero: "91",
    ementa: "Publicação e eficácia",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "92": {
    numero: "92",
    ementa: "Duração dos contratos",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "93": {
    numero: "93",
    ementa: "Prorrogação de prazo",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "94": {
    numero: "94",
    ementa: "Prorrogação excepcional",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "95": {
    numero: "95",
    ementa: "Garantia de execução contratual",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "96": {
    numero: "96",
    ementa: "Modalidades de garantia",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "97": {
    numero: "97",
    ementa: "Valores e prazos de garantia",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "98": {
    numero: "98",
    ementa: "Liberação de garantia",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "99": {
    numero: "99",
    ementa: "Subcontratação",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "100": {
    numero: "100",
    ementa: "Limites de subcontratação",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "101": {
    numero: "101",
    ementa: "Responsabilidade solidária na subcontratação",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "102": {
    numero: "102",
    ementa: "Transferência de responsabilidade",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "103": {
    numero: "103",
    ementa: "Formação do preço",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "104": {
    numero: "104",
    ementa: "Composição de custos",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "105": {
    numero: "105",
    ementa: "Orçamento estimado sigiloso",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "106": {
    numero: "106",
    ementa: "Recebimento do objeto",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "107": {
    numero: "107",
    ementa: "Recebimento provisório",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "108": {
    numero: "108",
    ementa: "Recebimento definitivo",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "109": {
    numero: "109",
    ementa: "Responsabilidade por vícios",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "110": {
    numero: "110",
    ementa: "Critérios de sustentabilidade",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "111": {
    numero: "111",
    ementa: "Margem de preferência para produtos nacionais",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "112": {
    numero: "112",
    ementa: "Preferência para bens e serviços com tecnologia desenvolvida no País",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "113": {
    numero: "113",
    ementa: "Benefícios para microempresas e empresas de pequeno porte",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "114": {
    numero: "114",
    ementa: "Sociedades cooperativas",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },

  // EXECUÇÃO
  "115": {
    numero: "115",
    ementa: "Execução do contrato",
    capitulo: "TÍTULO III - CAPÍTULO II",
    secao: "Execução do Contrato"
  },
  "116": {
    numero: "116",
    ementa: "Fiscalização do contrato",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "117": {
    numero: "117",
    ementa: "Atribuições do fiscal",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "118": {
    numero: "118",
    ementa: "Gestor do contrato",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "119": {
    numero: "119",
    ementa: "Atribuições do gestor",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "120": {
    numero: "120",
    ementa: "Extinção do contrato",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "121": {
    numero: "121",
    ementa: "Extinção por conclusão",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "122": {
    numero: "122",
    ementa: "Extinção por rescisão",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "123": {
    numero: "123",
    ementa: "Motivos de rescisão",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },

  // ALTERAÇÕES
  "124": {
    numero: "124",
    ementa: "Alterações contratuais",
    capitulo: "TÍTULO III - CAPÍTULO III",
    secao: "Alterações Contratuais"
  },
  "125": {
    numero: "125",
    ementa: "Acréscimos e supressões",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "126": {
    numero: "126",
    ementa: "Consensualidade",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "127": {
    numero: "127",
    ementa: "Alteração unilateral",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "128": {
    numero: "128",
    ementa: "Limites de alteração quantitativa",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "129": {
    numero: "129",
    ementa: "Alteração de prazo",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "130": {
    numero: "130",
    ementa: "Alteração de regime de execução",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "131": {
    numero: "131",
    ementa: "Alteração de forma de pagamento",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "132": {
    numero: "132",
    ementa: "Substituição de garantia",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "133": {
    numero: "133",
    ementa: "Restabelecimento do equilíbrio econômico-financeiro",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "134": {
    numero: "134",
    ementa: "Formalização das alterações",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "135": {
    numero: "135",
    ementa: "Efeitos das alterações",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "136": {
    numero: "136",
    ementa: "Vedações às alterações",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },

  // REEQUILÍBRIO
  "137": {
    numero: "137",
    ementa: "Reequilíbrio econômico-financeiro",
    capitulo: "TÍTULO III - CAPÍTULO IV",
    secao: "Reequilíbrio Econômico-Financeiro"
  },
  "138": {
    numero: "138",
    ementa: "Revisão de preços",
    capitulo: "TÍTULO III - CAPÍTULO IV"
  },
  "139": {
    numero: "139",
    ementa: "Repactuação",
    capitulo: "TÍTULO III - CAPÍTULO IV"
  },
  "140": {
    numero: "140",
    ementa: "Pagamentos",
    capitulo: "TÍTULO III - CAPÍTULO V",
    secao: "Pagamentos"
  },
  "141": {
    numero: "141",
    ementa: "Prazos de pagamento",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "142": {
    numero: "142",
    ementa: "Antecipação de pagamento",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "143": {
    numero: "143",
    ementa: "Atraso no pagamento",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "144": {
    numero: "144",
    ementa: "Retenções tributárias e previdenciárias",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "145": {
    numero: "145",
    ementa: "Exceção de contrato não cumprido",
    capitulo: "TÍTULO III - CAPÍTULO VI",
    secao: "Direitos e Obrigações"
  },
  "146": {
    numero: "146",
    ementa: "Prevenção de conflitos",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "147": {
    numero: "147",
    ementa: "Solução consensual de controvérsias",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "148": {
    numero: "148",
    ementa: "Arbitragem",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "149": {
    numero: "149",
    ementa: "Comitê de resolução de disputas",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "150": {
    numero: "150",
    ementa: "Intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII",
    secao: "Intervenção"
  },
  "151": {
    numero: "151",
    ementa: "Hipóteses de intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "152": {
    numero: "152",
    ementa: "Procedimento de intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "153": {
    numero: "153",
    ementa: "Efeitos da intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "154": {
    numero: "154",
    ementa: "Cessação da intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },

  // SANÇÕES
  "155": {
    numero: "155",
    ementa: "Sanções administrativas",
    capitulo: "TÍTULO IV - CAPÍTULO I",
    secao: "Sanções Administrativas"
  },
  "156": {
    numero: "156",
    ementa: "Advertência",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "157": {
    numero: "157",
    ementa: "Multa",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "158": {
    numero: "158",
    ementa: "Impedimento de licitar",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "159": {
    numero: "159",
    ementa: "Declaração de inidoneidade",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },

  // PROCESSO SANCIONADOR
  "160": {
    numero: "160",
    ementa: "Processo administrativo sancionador",
    capitulo: "TÍTULO IV - CAPÍTULO II",
    secao: "Processo Sancionador"
  },
  "161": {
    numero: "161",
    ementa: "Fases do processo sancionador",
    capitulo: "TÍTULO IV - CAPÍTULO II"
  },
  "162": {
    numero: "162",
    ementa: "Defesa e contraditório",
    capitulo: "TÍTULO IV - CAPÍTULO II"
  },
  "163": {
    numero: "163",
    ementa: "Crimes em licitações e contratos",
    capitulo: "TÍTULO IV - CAPÍTULO III",
    secao: "Crimes e Infrações Penais"
  },
  "164": {
    numero: "164",
    ementa: "Fraude em licitação",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "165": {
    numero: "165",
    ementa: "Frustrar caráter competitivo",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "166": {
    numero: "166",
    ementa: "Afastamento de licitante",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "167": {
    numero: "167",
    ementa: "Fraude em contrato",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "168": {
    numero: "168",
    ementa: "Admissão indevida em licitação",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "169": {
    numero: "169",
    ementa: "Concussão",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "170": {
    numero: "170",
    ementa: "Corrupção",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "171": {
    numero: "171",
    ementa: "Impedimento ilegal de participação",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "172": {
    numero: "172",
    ementa: "Perturbação de processo licitatório",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "173": {
    numero: "173",
    ementa: "Violação de sigilo",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },

  // INOVAÇÃO
  "174": {
    numero: "174",
    ementa: "Encomendas tecnológicas",
    capitulo: "TÍTULO V",
    secao: "Inovação e Tecnologia"
  },
  "175": {
    numero: "175",
    ementa: "Credenciamento",
    capitulo: "TÍTULO V"
  },
  "176": {
    numero: "176",
    ementa: "Contratação de remanescente de obra",
    capitulo: "TÍTULO V"
  },
  "177": {
    numero: "177",
    ementa: "Seguro-garantia",
    capitulo: "TÍTULO V"
  },
  "178": {
    numero: "178",
    ementa: "Normas específicas para obras e serviços de engenharia",
    capitulo: "TÍTULO V"
  },
  "179": {
    numero: "179",
    ementa: "Parcerias da Administração Pública",
    capitulo: "TÍTULO V"
  },

  // TERCEIRIZAÇÃO
  "180": {
    numero: "180",
    ementa: "Contratação de terceiros",
    capitulo: "TÍTULO VI",
    secao: "Terceirização e Mão de Obra"
  },
  "181": {
    numero: "181",
    ementa: "Responsabilidade trabalhista",
    capitulo: "TÍTULO VI"
  },

  // DISPOSIÇÕES TRANSITÓRIAS E FINAIS
  "182": {
    numero: "182",
    ementa: "Transitório - licitações em andamento",
    capitulo: "TÍTULO VII",
    secao: "Disposições Transitórias"
  },
  "183": {
    numero: "183",
    ementa: "Transitório - contratos vigentes",
    capitulo: "TÍTULO VII"
  },
  "184": {
    numero: "184",
    ementa: "Transitório - regulamentação",
    capitulo: "TÍTULO VII"
  },
  "185": {
    numero: "185",
    ementa: "Transitório - capacitação de agentes",
    capitulo: "TÍTULO VII"
  },
  "186": {
    numero: "186",
    ementa: "Transitório - sistemas informatizados",
    capitulo: "TÍTULO VII"
  },
  "187": {
    numero: "187",
    ementa: "Transitório - Portal Nacional de Contratações Públicas",
    capitulo: "TÍTULO VII"
  },
  "188": {
    numero: "188",
    ementa: "Transitório - adequação normativa",
    capitulo: "TÍTULO VII"
  },
  "189": {
    numero: "189",
    ementa: "Alterações na Lei nº 10.522/2002",
    capitulo: "TÍTULO VII"
  },
  "190": {
    numero: "190",
    ementa: "Alterações na Lei nº 12.462/2011 (RDC)",
    capitulo: "TÍTULO VII"
  },

  // DISPOSIÇÕES FINAIS
  "191": {
    numero: "191",
    ementa: "Portal Nacional de Contratações Públicas (PNCP)",
    capitulo: "TÍTULO VII",
    secao: "Disposições Finais"
  },
  "192": {
    numero: "192",
    ementa: "Revogações",
    capitulo: "TÍTULO VII"
  },
  "193": {
    numero: "193",
    ementa: "Vigência",
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

// Sugestões de artigos populares (mais usados)
export const ARTIGOS_POPULARES = [
  "6",   // Princípios
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
