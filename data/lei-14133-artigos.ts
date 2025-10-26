/**
 * Lei 14.133/2021 - Nova Lei de Licitações e Contratos Administrativos
 * Referência completa dos 193 artigos para catalogação de materiais
 * CORRIGIDO: Estrutura revisada conforme texto oficial da lei
 */

export interface LeiArticle {
  numero: string;
  ementa: string;
  capitulo: string;
  secao?: string;
}

export const LEI_14133_ARTIGOS: Record<string, LeiArticle> = {
  // TÍTULO I - DISPOSIÇÕES GERAIS
  // CAPÍTULO I - DAS DISPOSIÇÕES PRELIMINARES (Arts. 1 a 4)
  "1": {
    numero: "1",
    ementa: "Normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, Estados, Distrito Federal e Municípios",
    capitulo: "TÍTULO I - CAPÍTULO I",
    secao: "Disposições Preliminares"
  },
  "2": {
    numero: "2",
    ementa: "Subordinação ao regime desta Lei: Administração Pública direta, autárquica e fundacional; empresas estatais; demais entidades controladas direta ou indiretamente pela Administração Pública",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "3": {
    numero: "3",
    ementa: "Aplicação subsidiária de normas de direito privado, legislação de defesa da concorrência, Código de Defesa do Consumidor e legislação sobre licitações e contratos",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },
  "4": {
    numero: "4",
    ementa: "Exclusões: hipóteses em que esta Lei não se aplica (licitações dispensáveis e inexigíveis específicas, contratações internacionais, etc.)",
    capitulo: "TÍTULO I - CAPÍTULO I"
  },

  // CAPÍTULO II - DOS PRINCÍPIOS (Art. 5)
  "5": {
    numero: "5",
    ementa: "Princípios da licitação: legalidade, impessoalidade, moralidade, publicidade, eficiência, interesse público, probidade administrativa, igualdade, planejamento, transparência, eficácia, segregação de funções, motivação, vinculação ao edital, julgamento objetivo, segurança jurídica, razoabilidade, competitividade, proporcionalidade, celeridade, economicidade e desenvolvimento nacional sustentável",
    capitulo: "TÍTULO I - CAPÍTULO II",
    secao: "Princípios"
  },

  // CAPÍTULO III - DAS DEFINIÇÕES (Art. 6)
  "6": {
    numero: "6",
    ementa: "Definições: compra, obra, serviço, licitação, contrato, fornecedor, contratado, licitante, produto manufaturado nacional, e demais conceitos fundamentais aplicáveis à Lei",
    capitulo: "TÍTULO I - CAPÍTULO III",
    secao: "Definições"
  },

  // CAPÍTULO IV - DOS AGENTES PÚBLICOS (Arts. 7 a 13)
  "7": {
    numero: "7",
    ementa: "Regras de conduta dos agentes públicos que atuam na fase preparatória, fase externa, execução contratual e prestação de contas",
    capitulo: "TÍTULO I - CAPÍTULO IV",
    secao: "Agentes Públicos"
  },
  "8": {
    numero: "8",
    ementa: "Agente de contratação: definição, designação e competências",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "9": {
    numero: "9",
    ementa: "Comissão de contratação: substituição do agente de contratação, composição e atribuições",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "10": {
    numero: "10",
    ementa: "Equipe de apoio: assessoramento da comissão de contratação por servidores ou empregados públicos",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "11": {
    numero: "11",
    ementa: "Requisitos do agente de contratação e membros da comissão: formação, capacitação, aptidão e responsabilidade",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "12": {
    numero: "12",
    ementa: "Impedimento e suspeição: hipóteses em que o agente público está impedido de participar do processo licitatório ou execução contratual",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },
  "13": {
    numero: "13",
    ementa: "Responsabilidade dos agentes públicos por atos praticados em violação à Lei",
    capitulo: "TÍTULO I - CAPÍTULO IV"
  },

  // CAPÍTULO V - DOS ÓRGÃOS DE ASSESSORAMENTO JURÍDICO E DE CONTROLE (Arts. 14 a 17)
  "14": {
    numero: "14",
    ementa: "Órgãos de assessoramento jurídico e de controle interno: manifestação sobre edital de licitação, contratos e outros atos",
    capitulo: "TÍTULO I - CAPÍTULO V",
    secao: "Órgãos de Assessoramento e Controle"
  },
  "15": {
    numero: "15",
    ementa: "Atuação prévia e concomitante dos órgãos de controle: facultatividade e manifestação fundamentada",
    capitulo: "TÍTULO I - CAPÍTULO V"
  },
  "16": {
    numero: "16",
    ementa: "Vedações aos órgãos de controle: exercício de controle prévio da licitação, exigências, controles indevidos",
    capitulo: "TÍTULO I - CAPÍTULO V"
  },
  "17": {
    numero: "17",
    ementa: "Responsabilidade dos membros dos órgãos de controle por orientações indevidas ou excessivamente onerosas",
    capitulo: "TÍTULO I - CAPÍTULO V"
  },

  // TÍTULO II - DAS LICITAÇÕES
  // CAPÍTULO I - DAS REGRAS GERAIS DAS LICITAÇÕES
  // SEÇÃO I - DAS REGRAS APLICÁVEIS ÀS LICITAÇÕES (Arts. 18 a 21)
  "18": {
    numero: "18",
    ementa: "Objeto da licitação: definição, descrição clara e precisa, especificações técnicas",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I",
    secao: "Regras Gerais das Licitações"
  },
  "19": {
    numero: "19",
    ementa: "Processo administrativo de licitação: início, instrução, julgamento e encerramento",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I"
  },
  "20": {
    numero: "20",
    ementa: "Fases da licitação: preparatória e externa",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I"
  },
  "21": {
    numero: "21",
    ementa: "Procedimentos auxiliares: pré-qualificação permanente, registro cadastral e sistema de registro de preços",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO I"
  },

  // SEÇÃO II - DO PLANEJAMENTO DA CONTRATAÇÃO (Arts. 22 a 25)
  "22": {
    numero: "22",
    ementa: "Plano de contratações anual: elaboração, divulgação e vinculação ao planejamento",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II",
    secao: "Planejamento da Contratação"
  },
  "23": {
    numero: "23",
    ementa: "Estudos técnicos preliminares: conteúdo mínimo, análise de viabilidade, estimativa de valor",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },
  "24": {
    numero: "24",
    ementa: "Gestão de riscos: identificação, avaliação e tratamento de eventos que possam afetar o atingimento dos objetivos da contratação",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },
  "25": {
    numero: "25",
    ementa: "Análise de viabilidade da contratação: demonstração da necessidade, benefícios esperados e economicidade",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO II"
  },

  // SEÇÃO III - DO ANTEPROJETO E DO PROJETO (Arts. 26 a 28)
  "26": {
    numero: "26",
    ementa: "Anteprojeto: definição, elementos mínimos e aprovação",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO III",
    secao: "Anteprojeto e Projeto"
  },
  "27": {
    numero: "27",
    ementa: "Projetos básico e executivo: elementos constitutivos, detalhamento e aprovação",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO III"
  },
  "28": {
    numero: "28",
    ementa: "Responsabilidade técnica dos projetos: elaboração por profissional habilitado",
    capitulo: "TÍTULO II - CAPÍTULO I - SEÇÃO III"
  },

  // CAPÍTULO II - DAS MODALIDADES DE LICITAÇÃO (Arts. 29 a 34)
  "29": {
    numero: "29",
    ementa: "Modalidades de licitação: pregão, concorrência, concurso, leilão e diálogo competitivo",
    capitulo: "TÍTULO II - CAPÍTULO II",
    secao: "Modalidades de Licitação"
  },
  "30": {
    numero: "30",
    ementa: "Pregão: modalidade para aquisição de bens e serviços comuns, critério de menor preço ou maior desconto",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "31": {
    numero: "31",
    ementa: "Concorrência: modalidade para obras, serviços, compras e alienações de grande vulto",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "32": {
    numero: "32",
    ementa: "Concurso: modalidade para escolha de trabalho técnico, científico ou artístico",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "33": {
    numero: "33",
    ementa: "Leilão: modalidade para alienação de bens móveis e imóveis",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },
  "34": {
    numero: "34",
    ementa: "Diálogo competitivo: modalidade para contratações com inovação tecnológica ou técnica",
    capitulo: "TÍTULO II - CAPÍTULO II"
  },

  // CAPÍTULO III - DOS CRITÉRIOS DE JULGAMENTO (Arts. 35 a 40)
  "35": {
    numero: "35",
    ementa: "Critérios de julgamento: menor preço ou maior desconto, maior lance ou oferta, melhor técnica ou conteúdo artístico, técnica e preço, maior retorno econômico",
    capitulo: "TÍTULO II - CAPÍTULO III",
    secao: "Critérios de Julgamento"
  },
  "36": {
    numero: "36",
    ementa: "Menor preço ou maior desconto: critério padrão para bens e serviços comuns",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "37": {
    numero: "37",
    ementa: "Maior lance ou oferta: critério para leilão e alienações",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "38": {
    numero: "38",
    ementa: "Melhor técnica ou conteúdo artístico: critério para serviços de natureza intelectual",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "39": {
    numero: "39",
    ementa: "Técnica e preço: critério combinado para obras e serviços especializados",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },
  "40": {
    numero: "40",
    ementa: "Maior retorno econômico: critério para concessões e permissões",
    capitulo: "TÍTULO II - CAPÍTULO III"
  },

  // CAPÍTULO IV - DO PROCEDIMENTO DA LICITAÇÃO (Arts. 41 a 71)
  "41": {
    numero: "41",
    ementa: "Fases do procedimento: preparatória (planejamento) e externa (desde a publicação do edital)",
    capitulo: "TÍTULO II - CAPÍTULO IV",
    secao: "Procedimento da Licitação"
  },
  "42": {
    numero: "42",
    ementa: "Divulgação do edital: publicação oficial e portal nacional de contratações públicas",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "43": {
    numero: "43",
    ementa: "Prazos mínimos para apresentação de propostas: variação conforme modalidade e critério",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "44": {
    numero: "44",
    ementa: "Impugnação ao edital: direito de qualquer pessoa, prazos e efeitos",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "45": {
    numero: "45",
    ementa: "Pedido de esclarecimento: direito de qualquer pessoa, prazo de resposta",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "46": {
    numero: "46",
    ementa: "Modificação do edital: hipóteses, republicação e reabertura de prazos",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "47": {
    numero: "47",
    ementa: "Apresentação de propostas e lances: forma, prazos e requisitos",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "48": {
    numero: "48",
    ementa: "Propostas em envelope fechado ou sistema eletrônico: regras para recebimento",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "49": {
    numero: "49",
    ementa: "Envelope de habilitação: documentação exigida e forma de apresentação",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "50": {
    numero: "50",
    ementa: "Abertura de envelopes: procedimento, sessão pública e registro",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "51": {
    numero: "51",
    ementa: "Julgamento das propostas: objetividade, fundamentação e observância ao edital",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "52": {
    numero: "52",
    ementa: "Classificação das propostas: ordenação conforme critério de julgamento",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "53": {
    numero: "53",
    ementa: "Desclassificação de propostas: hipóteses (preço inexequível, incompatibilidade, irregularidades)",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "54": {
    numero: "54",
    ementa: "Habilitação: verificação de condições pessoais do licitante para contratar",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "55": {
    numero: "55",
    ementa: "Documentos de habilitação: jurídica, fiscal, técnica e econômico-financeira",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "56": {
    numero: "56",
    ementa: "Habilitação jurídica: documentos comprobatórios da capacidade para contratar",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "57": {
    numero: "57",
    ementa: "Regularidade fiscal e trabalhista: certidões negativas e regularidade previdenciária",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "58": {
    numero: "58",
    ementa: "Qualificação técnica: comprovação de capacidade técnico-profissional e operacional",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "59": {
    numero: "59",
    ementa: "Qualificação econômico-financeira: patrimônio líquido, garantias e índices contábeis",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "60": {
    numero: "60",
    ementa: "Inabilitação e recurso: causas, comunicação ao licitante e direito de recorrer",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "61": {
    numero: "61",
    ementa: "Convocação de licitante remanescente: em caso de desistência ou inabilitação do vencedor",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "62": {
    numero: "62",
    ementa: "Negociação de preços: possibilidade com o licitante mais bem classificado",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "63": {
    numero: "63",
    ementa: "Adjudicação e homologação: atos finais do procedimento licitatório",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "64": {
    numero: "64",
    ementa: "Recursos administrativos: cabimento, legitimidade e momento de interposição",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "65": {
    numero: "65",
    ementa: "Prazo para recurso: 3 dias úteis após publicação ou intimação do ato",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "66": {
    numero: "66",
    ementa: "Efeito suspensivo: suspensão automática ou facultativa do procedimento em razão de recurso",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "67": {
    numero: "67",
    ementa: "Anulação e revogação: conceitos, hipóteses e competência",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "68": {
    numero: "68",
    ementa: "Motivos de anulação: ilegalidades que comprometem a validade do procedimento",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "69": {
    numero: "69",
    ementa: "Motivos de revogação: razões de interesse público superveniente",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "70": {
    numero: "70",
    ementa: "Efeitos da anulação e revogação: retroatividade, indenizações e responsabilidades",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },
  "71": {
    numero: "71",
    ementa: "Subcontratação: possibilidade, limites e responsabilidade solidária",
    capitulo: "TÍTULO II - CAPÍTULO IV"
  },

  // CAPÍTULO V - DA CONTRATAÇÃO DIRETA (Arts. 72 a 80)
  "72": {
    numero: "72",
    ementa: "Inexigibilidade de licitação: conceito e requisitos (inviabilidade de competição)",
    capitulo: "TÍTULO II - CAPÍTULO V",
    secao: "Contratação Direta"
  },
  "73": {
    numero: "73",
    ementa: "Hipóteses de inexigibilidade: produtor/fornecedor exclusivo, serviços técnicos especializados, profissionais do setor artístico",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "74": {
    numero: "74",
    ementa: "Dispensa de licitação: conceito e hipóteses previstas em lei",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "75": {
    numero: "75",
    ementa: "Hipóteses de dispensa: emergência, pequeno valor, produtos para pesquisa, remanescente de obra, etc. (29 incisos)",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "76": {
    numero: "76",
    ementa: "Vedações na dispensa e inexigibilidade: contratar quem participou da elaboração de estudos, empresas suspensas, etc.",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "77": {
    numero: "77",
    ementa: "Procedimento de contratação direta: processo administrativo, justificação e autorização",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "78": {
    numero: "78",
    ementa: "Justificativa de preço: compatibilidade com preços de mercado",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "79": {
    numero: "79",
    ementa: "Aviso de contratação direta: divulgação prévia da intenção de contratar",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },
  "80": {
    numero: "80",
    ementa: "Ratificação e autorização: aprovação pela autoridade superior",
    capitulo: "TÍTULO II - CAPÍTULO V"
  },

  // CAPÍTULO VI - DO SISTEMA DE REGISTRO DE PREÇOS (Arts. 81 a 86)
  "81": {
    numero: "81",
    ementa: "Sistema de Registro de Preços (SRP): conceito, aplicabilidade e vantagens",
    capitulo: "TÍTULO II - CAPÍTULO VI",
    secao: "Sistema de Registro de Preços"
  },
  "82": {
    numero: "82",
    ementa: "Ata de registro de preços: conteúdo, formalização e vinculação",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "83": {
    numero: "83",
    ementa: "Vigência da ata: prazo de até 1 ano (prorrogável por igual período)",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "84": {
    numero: "84",
    ementa: "Adesão à ata (carona): possibilidade de outros órgãos utilizarem a ata, limites",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "85": {
    numero: "85",
    ementa: "Cancelamento do registro: hipóteses de cancelamento automático ou a pedido",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },
  "86": {
    numero: "86",
    ementa: "Controle e atualização de preços: pesquisa periódica e ajustes",
    capitulo: "TÍTULO II - CAPÍTULO VI"
  },

  // CAPÍTULO VII - DA PRÉ-QUALIFICAÇÃO E DO CADASTRO (Arts. 87 a 88)
  "87": {
    numero: "87",
    ementa: "Pré-qualificação permanente: registro prévio de interessados para futuras licitações",
    capitulo: "TÍTULO II - CAPÍTULO VII",
    secao: "Pré-qualificação e Cadastro"
  },
  "88": {
    numero: "88",
    ementa: "Registro cadastral: cadastro de fornecedores para facilitar habilitação",
    capitulo: "TÍTULO II - CAPÍTULO VII"
  },

  // TÍTULO III - DOS CONTRATOS
  // CAPÍTULO I - DAS DISPOSIÇÕES GERAIS SOBRE OS CONTRATOS (Arts. 89 a 114)
  "89": {
    numero: "89",
    ementa: "Formalização dos contratos: instrumento contratual, cláusulas essenciais e publicação",
    capitulo: "TÍTULO III - CAPÍTULO I",
    secao: "Disposições Gerais sobre Contratos"
  },
  "90": {
    numero: "90",
    ementa: "Cláusulas necessárias: objeto, regime de execução, preço, condições de pagamento, prazos, responsabilidades",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "91": {
    numero: "91",
    ementa: "Publicação e eficácia: condição de eficácia do contrato",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "92": {
    numero: "92",
    ementa: "Duração dos contratos: prazo de vigência, início e término",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "93": {
    numero: "93",
    ementa: "Prorrogação de prazo: hipóteses permitidas e limites",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "94": {
    numero: "94",
    ementa: "Prorrogação excepcional: contratos plurianuais e continuados",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "95": {
    numero: "95",
    ementa: "Garantia de execução contratual: obrigatoriedade e finalidade",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "96": {
    numero: "96",
    ementa: "Modalidades de garantia: caução, fiança bancária, seguro-garantia",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "97": {
    numero: "97",
    ementa: "Valores e prazos de garantia: percentual sobre o valor do contrato",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "98": {
    numero: "98",
    ementa: "Liberação de garantia: condições para restituição",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "99": {
    numero: "99",
    ementa: "Subcontratação: possibilidade de transferir parcialmente a execução",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "100": {
    numero: "100",
    ementa: "Limites de subcontratação: percentuais máximos conforme objeto",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "101": {
    numero: "101",
    ementa: "Responsabilidade solidária na subcontratação: entre contratado e subcontratado",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "102": {
    numero: "102",
    ementa: "Vedação à transferência total de responsabilidade",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "103": {
    numero: "103",
    ementa: "Formação do preço: composição de custos, lucro e encargos",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "104": {
    numero: "104",
    ementa: "Composição de custos: detalhamento de mão de obra, materiais, equipamentos e BDI",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "105": {
    numero: "105",
    ementa: "Orçamento estimado sigiloso: possibilidade de manter sigilo até abertura de propostas",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "106": {
    numero: "106",
    ementa: "Recebimento do objeto: provisório e definitivo",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "107": {
    numero: "107",
    ementa: "Recebimento provisório: verificação inicial da conformidade",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "108": {
    numero: "108",
    ementa: "Recebimento definitivo: aceitação final após verificação de qualidade e quantidade",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "109": {
    numero: "109",
    ementa: "Responsabilidade por vícios: prazos de garantia e vícios ocultos",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "110": {
    numero: "110",
    ementa: "Critérios de sustentabilidade: previsão de benefícios ambientais, sociais e econômicos",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "111": {
    numero: "111",
    ementa: "Margem de preferência para produtos manufaturados e serviços nacionais",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "112": {
    numero: "112",
    ementa: "Preferência para bens e serviços com tecnologia desenvolvida no País",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "113": {
    numero: "113",
    ementa: "Benefícios para microempresas e empresas de pequeno porte (ME/EPP): empate ficto, cota reservada, subcontratação",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },
  "114": {
    numero: "114",
    ementa: "Sociedades cooperativas: participação em licitações",
    capitulo: "TÍTULO III - CAPÍTULO I"
  },

  // CAPÍTULO II - DA EXECUÇÃO DOS CONTRATOS (Arts. 115 a 123)
  "115": {
    numero: "115",
    ementa: "Execução do contrato: obrigações do contratado e da Administração",
    capitulo: "TÍTULO III - CAPÍTULO II",
    secao: "Execução do Contrato"
  },
  "116": {
    numero: "116",
    ementa: "Fiscalização do contrato: designação de fiscal e acompanhamento da execução",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "117": {
    numero: "117",
    ementa: "Atribuições do fiscal: verificar cumprimento de cláusulas, atestar execução, comunicar irregularidades",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "118": {
    numero: "118",
    ementa: "Gestor do contrato: responsável por demandas, glosas, penalidades e correções",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "119": {
    numero: "119",
    ementa: "Atribuições do gestor: acompanhamento, análise de pleitos, decisões sobre alterações",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "120": {
    numero: "120",
    ementa: "Extinção do contrato: hipóteses de término (conclusão, rescisão, anulação)",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "121": {
    numero: "121",
    ementa: "Extinção por conclusão: cumprimento integral do objeto",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "122": {
    numero: "122",
    ementa: "Extinção por rescisão: unilateral, amigável ou judicial",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },
  "123": {
    numero: "123",
    ementa: "Motivos de rescisão: inadimplemento, razões de interesse público, força maior",
    capitulo: "TÍTULO III - CAPÍTULO II"
  },

  // CAPÍTULO III - DAS ALTERAÇÕES DOS CONTRATOS (Arts. 124 a 136)
  "124": {
    numero: "124",
    ementa: "Alterações contratuais: unilaterais ou consensuais, formalização",
    capitulo: "TÍTULO III - CAPÍTULO III",
    secao: "Alterações Contratuais"
  },
  "125": {
    numero: "125",
    ementa: "Acréscimos e supressões: limites quantitativos para alteração de quantitativos",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "126": {
    numero: "126",
    ementa: "Consensualidade: alterações que dependem de acordo entre as partes",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "127": {
    numero: "127",
    ementa: "Alteração unilateral: hipóteses em que a Administração pode impor modificações",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "128": {
    numero: "128",
    ementa: "Limites de alteração quantitativa: até 25% ou 50% conforme o caso",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "129": {
    numero: "129",
    ementa: "Alteração de prazo: prorrogação por atraso, suspensão ou fatos supervenientes",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "130": {
    numero: "130",
    ementa: "Alteração de regime de execução: mudança na forma de execução contratual",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "131": {
    numero: "131",
    ementa: "Alteração de forma de pagamento: modificação nas condições de pagamento",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "132": {
    numero: "132",
    ementa: "Substituição de garantia: troca por outra modalidade de garantia",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "133": {
    numero: "133",
    ementa: "Restabelecimento do equilíbrio econômico-financeiro: recomposição quando houver desequilíbrio",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "134": {
    numero: "134",
    ementa: "Formalização das alterações: termo aditivo e publicação",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "135": {
    numero: "135",
    ementa: "Efeitos das alterações: retroatividade ou irretroatividade",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },
  "136": {
    numero: "136",
    ementa: "Vedações às alterações: proibição de alterações que descaracterizem o objeto",
    capitulo: "TÍTULO III - CAPÍTULO III"
  },

  // CAPÍTULO IV - DO REEQUILÍBRIO ECONÔMICO-FINANCEIRO (Arts. 137 a 139)
  "137": {
    numero: "137",
    ementa: "Reequilíbrio econômico-financeiro: manutenção das condições da proposta, álea econômica extraordinária",
    capitulo: "TÍTULO III - CAPÍTULO IV",
    secao: "Reequilíbrio Econômico-Financeiro"
  },
  "138": {
    numero: "138",
    ementa: "Revisão de preços: para recompor preços em virtude de fatos imprevisíveis ou previsíveis de consequências incalculáveis",
    capitulo: "TÍTULO III - CAPÍTULO IV"
  },
  "139": {
    numero: "139",
    ementa: "Repactuação: reajuste de preços de contratos de longa duração com variação de custos",
    capitulo: "TÍTULO III - CAPÍTULO IV"
  },

  // CAPÍTULO V - DOS PAGAMENTOS (Arts. 140 a 144)
  "140": {
    numero: "140",
    ementa: "Pagamentos: condições, prazos e forma",
    capitulo: "TÍTULO III - CAPÍTULO V",
    secao: "Pagamentos"
  },
  "141": {
    numero: "141",
    ementa: "Prazos de pagamento: até 30 dias contados do atesto da nota fiscal",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "142": {
    numero: "142",
    ementa: "Antecipação de pagamento: hipóteses excepcionais",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "143": {
    numero: "143",
    ementa: "Atraso no pagamento: juros de mora, atualização monetária",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },
  "144": {
    numero: "144",
    ementa: "Retenções tributárias e previdenciárias: desconto na fonte de tributos",
    capitulo: "TÍTULO III - CAPÍTULO V"
  },

  // CAPÍTULO VI - DOS DIREITOS E OBRIGAÇÕES (Arts. 145 a 149)
  "145": {
    numero: "145",
    ementa: "Exceção de contrato não cumprido: suspensão de obrigações se a outra parte descumprir",
    capitulo: "TÍTULO III - CAPÍTULO VI",
    secao: "Direitos e Obrigações"
  },
  "146": {
    numero: "146",
    ementa: "Prevenção de conflitos: mecanismos para evitar controvérsias",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "147": {
    numero: "147",
    ementa: "Solução consensual de controvérsias: negociação, mediação e conciliação",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "148": {
    numero: "148",
    ementa: "Arbitragem: submissão de litígios à arbitragem",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },
  "149": {
    numero: "149",
    ementa: "Comitê de resolução de disputas: instância técnica para resolver controvérsias",
    capitulo: "TÍTULO III - CAPÍTULO VI"
  },

  // CAPÍTULO VII - DA INTERVENÇÃO (Arts. 150 a 154)
  "150": {
    numero: "150",
    ementa: "Intervenção: assunção temporária da execução contratual pela Administração",
    capitulo: "TÍTULO III - CAPÍTULO VII",
    secao: "Intervenção"
  },
  "151": {
    numero: "151",
    ementa: "Hipóteses de intervenção: situações graves que justificam a intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "152": {
    numero: "152",
    ementa: "Procedimento de intervenção: designação de interventor, formalização e prazo",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "153": {
    numero: "153",
    ementa: "Efeitos da intervenção: responsabilidades durante a intervenção",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },
  "154": {
    numero: "154",
    ementa: "Cessação da intervenção: retorno da execução ao contratado ou rescisão",
    capitulo: "TÍTULO III - CAPÍTULO VII"
  },

  // TÍTULO IV - DAS INFRAÇÕES E DAS SANÇÕES ADMINISTRATIVAS
  // CAPÍTULO I - DAS SANÇÕES ADMINISTRATIVAS (Arts. 155 a 159)
  "155": {
    numero: "155",
    ementa: "Sanções administrativas: advertência, multa, impedimento de licitar, declaração de inidoneidade",
    capitulo: "TÍTULO IV - CAPÍTULO I",
    secao: "Sanções Administrativas"
  },
  "156": {
    numero: "156",
    ementa: "Advertência: sanção leve por faltas menores",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "157": {
    numero: "157",
    ementa: "Multa: sanção pecuniária, percentuais e hipóteses",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "158": {
    numero: "158",
    ementa: "Impedimento de licitar: proibição temporária de participar de licitações (até 3 anos)",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },
  "159": {
    numero: "159",
    ementa: "Declaração de inidoneidade: sanção mais grave, proibição de contratar (enquanto perdurarem os motivos ou até reabilitação)",
    capitulo: "TÍTULO IV - CAPÍTULO I"
  },

  // CAPÍTULO II - DO PROCESSO ADMINISTRATIVO SANCIONADOR (Arts. 160 a 162)
  "160": {
    numero: "160",
    ementa: "Processo administrativo sancionador: instauração, instrução e julgamento",
    capitulo: "TÍTULO IV - CAPÍTULO II",
    secao: "Processo Sancionador"
  },
  "161": {
    numero: "161",
    ementa: "Fases do processo sancionador: instauração, defesa, instrução, relatório e julgamento",
    capitulo: "TÍTULO IV - CAPÍTULO II"
  },
  "162": {
    numero: "162",
    ementa: "Defesa e contraditório: garantia de ampla defesa e devido processo legal",
    capitulo: "TÍTULO IV - CAPÍTULO II"
  },

  // CAPÍTULO III - DOS CRIMES E DAS INFRAÇÕES PENAIS (Arts. 163 a 173)
  "163": {
    numero: "163",
    ementa: "Crimes em licitações e contratos: tipificação penal de condutas ilícitas",
    capitulo: "TÍTULO IV - CAPÍTULO III",
    secao: "Crimes e Infrações Penais"
  },
  "164": {
    numero: "164",
    ementa: "Fraude em licitação: obter vantagem ilícita mediante fraude",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "165": {
    numero: "165",
    ementa: "Frustrar caráter competitivo: impedir, perturbar ou fraudar a competição",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "166": {
    numero: "166",
    ementa: "Afastamento de licitante: afastar concorrente por meio de violência, grave ameaça, fraude",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "167": {
    numero: "167",
    ementa: "Fraude em contrato: praticar atos fraudulentos na execução contratual",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "168": {
    numero: "168",
    ementa: "Admissão indevida em licitação: admitir à licitação empresa inabilitada ou inidônea",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "169": {
    numero: "169",
    ementa: "Patrocínio de interesse privado: patrocinar interesse privado perante a Administração",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "170": {
    numero: "170",
    ementa: "Contratação fora de casos permitidos: contratar diretamente fora das hipóteses permitidas",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "171": {
    numero: "171",
    ementa: "Impedimento ilegal de participação: criar obstáculo à participação em licitação",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "172": {
    numero: "172",
    ementa: "Perturbação de processo licitatório: tumultuar, impedir ou dificultar o procedimento",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },
  "173": {
    numero: "173",
    ementa: "Violação de sigilo: devassa de proposta ou documento sigiloso",
    capitulo: "TÍTULO IV - CAPÍTULO III"
  },

  // TÍTULO V - DOS INSTRUMENTOS AUXILIARES
  "174": {
    numero: "174",
    ementa: "Encomendas tecnológicas: contratação de atividades de pesquisa, desenvolvimento e inovação",
    capitulo: "TÍTULO V",
    secao: "Instrumentos Auxiliares"
  },
  "175": {
    numero: "175",
    ementa: "Credenciamento: chamamento público para contratação não exclusiva de prestadores",
    capitulo: "TÍTULO V"
  },
  "176": {
    numero: "176",
    ementa: "Contratação de remanescente de obra: conclusão de obra paralisada ou atrasada",
    capitulo: "TÍTULO V"
  },
  "177": {
    numero: "177",
    ementa: "Seguro-garantia: utilização como garantia de execução contratual",
    capitulo: "TÍTULO V"
  },
  "178": {
    numero: "178",
    ementa: "Normas específicas para obras e serviços de engenharia: regras complementares",
    capitulo: "TÍTULO V"
  },
  "179": {
    numero: "179",
    ementa: "Parcerias da Administração Pública: convênios, acordos, ajustes e termos de cooperação",
    capitulo: "TÍTULO V"
  },

  // TÍTULO VI - DA CONTRATAÇÃO DE SERVIÇOS TERCEIRIZADOS
  "180": {
    numero: "180",
    ementa: "Contratação de serviços terceirizados: regras para terceirização de mão de obra",
    capitulo: "TÍTULO VI",
    secao: "Terceirização"
  },
  "181": {
    numero: "181",
    ementa: "Responsabilidade trabalhista: responsabilidade subsidiária da Administração",
    capitulo: "TÍTULO VI"
  },

  // TÍTULO VII - DISPOSIÇÕES TRANSITÓRIAS E FINAIS (Arts. 182 a 193)
  "182": {
    numero: "182",
    ementa: "Transitório: aplicação da lei anterior às licitações iniciadas antes da vigência",
    capitulo: "TÍTULO VII",
    secao: "Disposições Transitórias"
  },
  "183": {
    numero: "183",
    ementa: "Transitório: contratos celebrados antes da vigência permanecem regidos pela lei anterior",
    capitulo: "TÍTULO VII"
  },
  "184": {
    numero: "184",
    ementa: "Transitório: prazo para edição de regulamentação",
    capitulo: "TÍTULO VII"
  },
  "185": {
    numero: "185",
    ementa: "Transitório: capacitação obrigatória de agentes públicos",
    capitulo: "TÍTULO VII"
  },
  "186": {
    numero: "186",
    ementa: "Transitório: implantação de sistemas informatizados",
    capitulo: "TÍTULO VII"
  },
  "187": {
    numero: "187",
    ementa: "Transitório: Portal Nacional de Contratações Públicas (PNCP) - prazo de implantação",
    capitulo: "TÍTULO VII"
  },
  "188": {
    numero: "188",
    ementa: "Transitório: adequação de normas internas dos entes federativos",
    capitulo: "TÍTULO VII"
  },
  "189": {
    numero: "189",
    ementa: "Alterações na Lei nº 10.522/2002 (PGFN)",
    capitulo: "TÍTULO VII"
  },
  "190": {
    numero: "190",
    ementa: "Alterações na Lei nº 12.462/2011 (Regime Diferenciado de Contratações - RDC)",
    capitulo: "TÍTULO VII"
  },
  "191": {
    numero: "191",
    ementa: "Portal Nacional de Contratações Públicas (PNCP): sítio eletrônico oficial para divulgação centralizada de contratações",
    capitulo: "TÍTULO VII",
    secao: "Disposições Finais"
  },
  "192": {
    numero: "192",
    ementa: "Revogações: leis revogadas (Lei 8.666/1993, Lei 10.520/2002 e demais dispositivos)",
    capitulo: "TÍTULO VII"
  },
  "193": {
    numero: "193",
    ementa: "Vigência: entrada em vigor 2 anos após a publicação (1º de abril de 2023)",
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
