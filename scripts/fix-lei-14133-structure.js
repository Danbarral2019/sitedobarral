/**
 * Script para corrigir a estrutura da Lei 14.133
 * Atualiza titulo, capituloCompleto, capitulo e secao de todos os artigos
 * com base na estrutura oficial do Planalto
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Estrutura oficial extraída do Planalto em 2025-11-30
const STRUCTURE = {
  // TÍTULO I - DISPOSIÇÕES PRELIMINARES
  '1': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO I', capituloNome: 'DO ÂMBITO DE APLICAÇÃO DESTA LEI', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '2': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO I', capituloNome: 'DO ÂMBITO DE APLICAÇÃO DESTA LEI', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '3': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO I', capituloNome: 'DO ÂMBITO DE APLICAÇÃO DESTA LEI', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '4': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO I', capituloNome: 'DO ÂMBITO DE APLICAÇÃO DESTA LEI', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '5': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO II', capituloNome: 'DOS PRINCÍPIOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '6': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO III', capituloNome: 'DAS DEFINIÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '7': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO IV', capituloNome: 'DOS AGENTES PÚBLICOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '8': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO IV', capituloNome: 'DOS AGENTES PÚBLICOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '9': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO IV', capituloNome: 'DOS AGENTES PÚBLICOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '10': { titulo: 'TÍTULO I', tituloNome: 'DISPOSIÇÕES PRELIMINARES', capitulo: 'CAPÍTULO IV', capituloNome: 'DOS AGENTES PÚBLICOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // TÍTULO II - DAS LICITAÇÕES - CAPÍTULO I
  '11': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '12': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '13': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '14': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '15': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '16': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '17': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO I', capituloNome: 'DO PROCESSO LICITATÓRIO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // TÍTULO II - CAPÍTULO II - DA FASE PREPARATÓRIA
  // Seção I - Da Instrução do Processo Licitatório (Arts. 18-27)
  '18': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '19': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '20': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '21': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '22': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '23': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '24': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '25': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '26': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },
  '27': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção I', secaoNome: 'Da Instrução do Processo Licitatório', subsecao: '', subsecaoNome: '' },

  // Seção II - Das Modalidades de Licitação (Arts. 28-32)
  '28': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção II', secaoNome: 'Das Modalidades de Licitação', subsecao: '', subsecaoNome: '' },
  '29': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção II', secaoNome: 'Das Modalidades de Licitação', subsecao: '', subsecaoNome: '' },
  '30': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção II', secaoNome: 'Das Modalidades de Licitação', subsecao: '', subsecaoNome: '' },
  '31': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção II', secaoNome: 'Das Modalidades de Licitação', subsecao: '', subsecaoNome: '' },
  '32': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção II', secaoNome: 'Das Modalidades de Licitação', subsecao: '', subsecaoNome: '' },

  // Seção III - Dos Critérios de Julgamento (Arts. 33-39)
  '33': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },
  '34': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },
  '35': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },
  '36': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },
  '37': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },
  '38': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },
  '39': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção III', secaoNome: 'Dos Critérios de Julgamento', subsecao: '', subsecaoNome: '' },

  // Seção IV - Disposições Setoriais - Subseção I - Das Compras (Arts. 40-44)
  '40': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção I', subsecaoNome: 'Das Compras' },
  '41': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção I', subsecaoNome: 'Das Compras' },
  '42': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção I', subsecaoNome: 'Das Compras' },
  '43': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção I', subsecaoNome: 'Das Compras' },
  '44': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção I', subsecaoNome: 'Das Compras' },
  // Art. 44-A será adicionado aqui quando fornecido
  '44-A': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção I', subsecaoNome: 'Das Compras' },

  // Subseção II - Das Obras e Serviços de Engenharia (Arts. 45-46)
  '45': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção II', subsecaoNome: 'Das Obras e Serviços de Engenharia' },
  '46': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção II', subsecaoNome: 'Das Obras e Serviços de Engenharia' },

  // Subseção III - Dos Serviços em Geral (Arts. 47-50)
  '47': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção III', subsecaoNome: 'Dos Serviços em Geral' },
  '48': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção III', subsecaoNome: 'Dos Serviços em Geral' },
  '49': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção III', subsecaoNome: 'Dos Serviços em Geral' },
  '50': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção III', subsecaoNome: 'Dos Serviços em Geral' },

  // Subseção IV - Da Locação de Imóveis (Art. 51)
  '51': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção IV', subsecaoNome: 'Da Locação de Imóveis' },

  // Subseção V - Das Licitações Internacionais (Art. 52)
  '52': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO II', capituloNome: 'DA FASE PREPARATÓRIA', secao: 'Seção IV', secaoNome: 'Disposições Setoriais', subsecao: 'Subseção V', subsecaoNome: 'Das Licitações Internacionais' },

  // CAPÍTULO III - DA DIVULGAÇÃO DO EDITAL DE LICITAÇÃO (Arts. 53-54)
  '53': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO III', capituloNome: 'DA DIVULGAÇÃO DO EDITAL DE LICITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '54': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO III', capituloNome: 'DA DIVULGAÇÃO DO EDITAL DE LICITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO IV - DA APRESENTAÇÃO DE PROPOSTAS E LANCES (Arts. 55-58)
  '55': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO IV', capituloNome: 'DA APRESENTAÇÃO DE PROPOSTAS E LANCES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '56': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO IV', capituloNome: 'DA APRESENTAÇÃO DE PROPOSTAS E LANCES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '57': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO IV', capituloNome: 'DA APRESENTAÇÃO DE PROPOSTAS E LANCES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '58': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO IV', capituloNome: 'DA APRESENTAÇÃO DE PROPOSTAS E LANCES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO V - DO JULGAMENTO (Arts. 59-61)
  '59': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO V', capituloNome: 'DO JULGAMENTO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '60': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO V', capituloNome: 'DO JULGAMENTO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '61': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO V', capituloNome: 'DO JULGAMENTO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO VI - DA HABILITAÇÃO (Arts. 62-70)
  '62': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '63': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '64': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '65': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '66': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '67': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '68': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '69': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '70': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VI', capituloNome: 'DA HABILITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO VII - DO ENCERRAMENTO DA LICITAÇÃO (Art. 71)
  '71': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VII', capituloNome: 'DO ENCERRAMENTO DA LICITAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO VIII - DA CONTRATAÇÃO DIRETA
  '72': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VIII', capituloNome: 'DA CONTRATAÇÃO DIRETA', secao: 'Seção I', secaoNome: 'Do Processo de Contratação Direta', subsecao: '', subsecaoNome: '' },
  '73': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VIII', capituloNome: 'DA CONTRATAÇÃO DIRETA', secao: 'Seção I', secaoNome: 'Do Processo de Contratação Direta', subsecao: '', subsecaoNome: '' },
  '74': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VIII', capituloNome: 'DA CONTRATAÇÃO DIRETA', secao: 'Seção II', secaoNome: 'Da Inexigibilidade de Licitação', subsecao: '', subsecaoNome: '' },
  '75': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO VIII', capituloNome: 'DA CONTRATAÇÃO DIRETA', secao: 'Seção III', secaoNome: 'Da Dispensa de Licitação', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO IX - DAS ALIENAÇÕES (Arts. 76-77)
  '76': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO IX', capituloNome: 'DAS ALIENAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '77': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO IX', capituloNome: 'DAS ALIENAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // CAPÍTULO X - DOS INSTRUMENTOS AUXILIARES
  '78': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção I', secaoNome: 'Dos Procedimentos Auxiliares', subsecao: '', subsecaoNome: '' },
  '79': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção II', secaoNome: 'Do Credenciamento', subsecao: '', subsecaoNome: '' },
  '80': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção III', secaoNome: 'Da Pré-Qualificação', subsecao: '', subsecaoNome: '' },
  '81': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção IV', secaoNome: 'Do Procedimento de Manifestação de Interesse', subsecao: '', subsecaoNome: '' },
  '82': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção V', secaoNome: 'Do Sistema de Registro de Preços', subsecao: '', subsecaoNome: '' },
  '83': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção V', secaoNome: 'Do Sistema de Registro de Preços', subsecao: '', subsecaoNome: '' },
  '84': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção V', secaoNome: 'Do Sistema de Registro de Preços', subsecao: '', subsecaoNome: '' },
  '85': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção V', secaoNome: 'Do Sistema de Registro de Preços', subsecao: '', subsecaoNome: '' },
  '86': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção V', secaoNome: 'Do Sistema de Registro de Preços', subsecao: '', subsecaoNome: '' },
  '87': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção VI', secaoNome: 'Do Registro Cadastral', subsecao: '', subsecaoNome: '' },
  '88': { titulo: 'TÍTULO II', tituloNome: 'DAS LICITAÇÕES', capitulo: 'CAPÍTULO X', capituloNome: 'DOS INSTRUMENTOS AUXILIARES', secao: 'Seção VI', secaoNome: 'Do Registro Cadastral', subsecao: '', subsecaoNome: '' },

  // TÍTULO III - DOS CONTRATOS ADMINISTRATIVOS
  '89': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '90': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '91': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '92': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '93': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '94': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '95': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO I', capituloNome: 'DA FORMALIZAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo II - DAS GARANTIAS (Arts. 96-102)
  '96': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '97': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '98': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '99': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '100': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '101': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '102': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS GARANTIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo III - DA ALOCAÇÃO DE RISCOS (Art. 103)
  '103': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO III', capituloNome: 'DA ALOCAÇÃO DE RISCOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo IV - DAS PRERROGATIVAS DA ADMINISTRAÇÃO (Art. 104)
  '104': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO IV', capituloNome: 'DAS PRERROGATIVAS DA ADMINISTRAÇÃO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo V - DA DURAÇÃO DOS CONTRATOS (Arts. 105-114)
  '105': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '106': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '107': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '108': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '109': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '110': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '111': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '112': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '113': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '114': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO V', capituloNome: 'DA DURAÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo VI - DA EXECUÇÃO DOS CONTRATOS (Arts. 115-123)
  '115': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '116': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '117': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '118': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '119': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '120': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '121': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '122': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '123': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VI', capituloNome: 'DA EXECUÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo VII - DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS (Arts. 124-136)
  '124': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '125': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '126': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '127': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '128': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '129': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '130': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '131': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '132': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '133': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '134': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '135': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '136': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VII', capituloNome: 'DA ALTERAÇÃO DOS CONTRATOS E DOS PREÇOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo VIII - DAS HIPÓTESES DE EXTINÇÃO DOS CONTRATOS (Arts. 137-139)
  '137': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VIII', capituloNome: 'DAS HIPÓTESES DE EXTINÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '138': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VIII', capituloNome: 'DAS HIPÓTESES DE EXTINÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '139': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO VIII', capituloNome: 'DAS HIPÓTESES DE EXTINÇÃO DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo IX - DO RECEBIMENTO DO OBJETO DO CONTRATO (Art. 140)
  '140': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO IX', capituloNome: 'DO RECEBIMENTO DO OBJETO DO CONTRATO', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo X - DOS PAGAMENTOS (Arts. 141-146)
  '141': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO X', capituloNome: 'DOS PAGAMENTOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '142': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO X', capituloNome: 'DOS PAGAMENTOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '143': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO X', capituloNome: 'DOS PAGAMENTOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '144': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO X', capituloNome: 'DOS PAGAMENTOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '145': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO X', capituloNome: 'DOS PAGAMENTOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '146': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO X', capituloNome: 'DOS PAGAMENTOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo XI - DA NULIDADE DOS CONTRATOS (Arts. 147-150)
  '147': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XI', capituloNome: 'DA NULIDADE DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '148': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XI', capituloNome: 'DA NULIDADE DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '149': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XI', capituloNome: 'DA NULIDADE DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '150': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XI', capituloNome: 'DA NULIDADE DOS CONTRATOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo XII - DOS MEIOS ALTERNATIVOS DE RESOLUÇÃO DE CONTROVÉRSIAS (Arts. 151-154)
  '151': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XII', capituloNome: 'DOS MEIOS ALTERNATIVOS DE RESOLUÇÃO DE CONTROVÉRSIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '152': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XII', capituloNome: 'DOS MEIOS ALTERNATIVOS DE RESOLUÇÃO DE CONTROVÉRSIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '153': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XII', capituloNome: 'DOS MEIOS ALTERNATIVOS DE RESOLUÇÃO DE CONTROVÉRSIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '154': { titulo: 'TÍTULO III', tituloNome: 'DOS CONTRATOS ADMINISTRATIVOS', capitulo: 'CAPÍTULO XII', capituloNome: 'DOS MEIOS ALTERNATIVOS DE RESOLUÇÃO DE CONTROVÉRSIAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // TÍTULO IV - DAS IRREGULARIDADES
  // Capítulo I - DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS (Arts. 155-163)
  '155': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '156': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '157': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '158': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '159': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '160': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '161': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '162': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '163': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO I', capituloNome: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo II - DAS IMPUGNAÇÕES, DOS PEDIDOS DE ESCLARECIMENTO E DOS RECURSOS (Arts. 164-168)
  '164': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO II', capituloNome: 'DAS IMPUGNAÇÕES, DOS PEDIDOS DE ESCLARECIMENTO E DOS RECURSOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '165': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO II', capituloNome: 'DAS IMPUGNAÇÕES, DOS PEDIDOS DE ESCLARECIMENTO E DOS RECURSOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '166': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO II', capituloNome: 'DAS IMPUGNAÇÕES, DOS PEDIDOS DE ESCLARECIMENTO E DOS RECURSOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '167': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO II', capituloNome: 'DAS IMPUGNAÇÕES, DOS PEDIDOS DE ESCLARECIMENTO E DOS RECURSOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '168': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO II', capituloNome: 'DAS IMPUGNAÇÕES, DOS PEDIDOS DE ESCLARECIMENTO E DOS RECURSOS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo III - DO CONTROLE DAS CONTRATAÇÕES (Arts. 169-173)
  '169': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO III', capituloNome: 'DO CONTROLE DAS CONTRATAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '170': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO III', capituloNome: 'DO CONTROLE DAS CONTRATAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '171': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO III', capituloNome: 'DO CONTROLE DAS CONTRATAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '172': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO III', capituloNome: 'DO CONTROLE DAS CONTRATAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '173': { titulo: 'TÍTULO IV', tituloNome: 'DAS IRREGULARIDADES', capitulo: 'CAPÍTULO III', capituloNome: 'DO CONTROLE DAS CONTRATAÇÕES', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // TÍTULO V - DISPOSIÇÕES GERAIS
  // Capítulo I - DO PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS (Arts. 174-176)
  '174': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO I', capituloNome: 'DO PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS (PNCP)', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '175': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO I', capituloNome: 'DO PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS (PNCP)', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '176': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO I', capituloNome: 'DO PORTAL NACIONAL DE CONTRATAÇÕES PÚBLICAS (PNCP)', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo II - DAS ALTERAÇÕES LEGISLATIVAS (Arts. 177-180)
  '177': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS ALTERAÇÕES LEGISLATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '178': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS ALTERAÇÕES LEGISLATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '179': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS ALTERAÇÕES LEGISLATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '180': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO II', capituloNome: 'DAS ALTERAÇÕES LEGISLATIVAS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },

  // Capítulo III - DISPOSIÇÕES TRANSITÓRIAS E FINAIS (Arts. 181-194)
  '181': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '182': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '183': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '184': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '184-A': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '185': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '186': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '187': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '188': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '189': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '190': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '191': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '192': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '193': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
  '194': { titulo: 'TÍTULO V', tituloNome: 'DISPOSIÇÕES GERAIS', capitulo: 'CAPÍTULO III', capituloNome: 'DISPOSIÇÕES TRANSITÓRIAS E FINAIS', secao: '', secaoNome: '', subsecao: '', subsecaoNome: '' },
};

async function main() {
  console.log('🔧 Corrigindo estrutura da Lei 14.133...\n');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const [numero, struct] of Object.entries(STRUCTURE)) {
    try {
      // Buscar artigo existente
      const article = await prisma.leiArticle.findUnique({ where: { numero } });

      if (!article) {
        console.log(`⚠️  Art. ${numero} não encontrado no banco`);
        notFound++;
        continue;
      }

      // Construir campos formatados
      const tituloFormatado = `${struct.titulo} - ${struct.tituloNome}`;
      const capituloFormatado = `${struct.capitulo} - ${struct.capituloNome}`;

      // Campo capitulo com hierarquia completa
      let capituloHierarquia = `${struct.titulo} - ${struct.capitulo}`;
      if (struct.secao) {
        capituloHierarquia += ` - ${struct.secao}`;
      }
      if (struct.subsecao) {
        capituloHierarquia += ` - ${struct.subsecao}`;
      }

      // Campo secao formatado
      let secaoFormatada = null;
      if (struct.secao && struct.secaoNome) {
        secaoFormatada = `${struct.secao} - ${struct.secaoNome}`;
        if (struct.subsecao && struct.subsecaoNome) {
          secaoFormatada += ` - ${struct.subsecao} - ${struct.subsecaoNome}`;
        }
      }

      // Atualizar artigo
      await prisma.leiArticle.update({
        where: { numero },
        data: {
          titulo: tituloFormatado,
          capituloCompleto: capituloFormatado,
          capitulo: capituloHierarquia,
          secao: secaoFormatada,
        }
      });

      updated++;
      console.log(`✅ Art. ${numero} atualizado`);

    } catch (error) {
      console.error(`❌ Erro ao atualizar Art. ${numero}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Resultado:`);
  console.log(`   ✅ Atualizados: ${updated}`);
  console.log(`   ⚠️  Não encontrados: ${notFound}`);
  console.log(`   ❌ Erros: ${errors}`);
  console.log('='.repeat(50));

  await prisma.$disconnect();
}

main().catch(console.error);
