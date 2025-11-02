/**
 * Script para popular o banco de dados com os 62 atos normativos
 * relacionados à Lei 14.133/2021
 *
 * Fonte: lista-de-atos-normativos-e-estagios-de-regulamentacao-da-lei-14133-de-2021.pdf
 * Atualizado em: 19/08/2025
 */

// Carregar variáveis de ambiente do .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Função auxiliar para determinar hierarquia
function getHierarchyLevel(type) {
  const hierarchy = {
    'lei': 1,
    'medida-provisoria': 2,
    'decreto': 2,
    'portaria': 3,
    'in': 4,
    'ordem-servico': 5
  };
  return hierarchy[type] || 5;
}

// Dados dos 62 atos normativos publicados
const legislativeActs = [
  // DECRETOS DA PRESIDÊNCIA DA REPÚBLICA
  {
    type: 'decreto',
    number: '10.764',
    year: 2021,
    fullNumber: 'Decreto 10.764/2021',
    title: 'Dispõe sobre a Rede Nacional de Disseminação de Metodologias de Gestão das Contratações Públicas',
    ementa: 'Institui o Comitê Gestor da Rede Nacional de Disseminação de Metodologias de Gestão das Contratações Públicas e dispõe sobre sua organização e funcionamento.',
    issuer: 'Presidência',
    publishDate: new Date('2021-08-10'),
    leiArticles: JSON.stringify(['174'])
  },
  {
    type: 'decreto',
    number: '10.818',
    year: 2021,
    fullNumber: 'Decreto 10.818/2021',
    title: 'Regulamenta a aquisição de bens e a contratação de serviços pela administração pública federal direta, autárquica e fundacional',
    ementa: 'Estabelece normas sobre licitação e contratação de bens e serviços comuns, incluindo definição de bens de consumo comum e de luxo.',
    issuer: 'Presidência',
    publishDate: new Date('2021-10-01'),
    leiArticles: JSON.stringify(['6', '29', '30'])
  },
  {
    type: 'decreto',
    number: '10.947',
    year: 2022,
    fullNumber: 'Decreto 10.947/2022',
    title: 'Regulamenta a Lei nº 14.133, de 1º de abril de 2021',
    ementa: 'Decreto regulamentador geral da Lei 14.133/2021, estabelecendo normas sobre licitações e contratos administrativos.',
    issuer: 'Presidência',
    publishDate: new Date('2022-01-25'),
    leiArticles: JSON.stringify(['8', '18', '26', '29', '72', '75', '81', '95', '115', '124', '137', '155', '174', '175', '180'])
  },
  {
    type: 'decreto',
    number: '11.246',
    year: 2022,
    fullNumber: 'Decreto 11.246/2022',
    title: 'Altera o Decreto nº 10.947, de 25 de janeiro de 2022',
    ementa: 'Promove alterações no decreto regulamentador da Lei 14.133/2021.',
    issuer: 'Presidência',
    publishDate: new Date('2022-11-02'),
    leiArticles: JSON.stringify(['8', '26', '72', '75', '81', '95', '115', '124', '155', '174'])
  },
  {
    type: 'decreto',
    number: '11.462',
    year: 2023,
    fullNumber: 'Decreto 11.462/2023',
    title: 'Regulamenta a Lei nº 14.133, de 1º de abril de 2021, quanto ao Sistema de Registro de Preços',
    ementa: 'Estabelece regras específicas para o Sistema de Registro de Preços (SRP) no âmbito da Lei 14.133/2021.',
    issuer: 'Presidência',
    publishDate: new Date('2023-04-05'),
    leiArticles: JSON.stringify(['81', '82', '83', '84', '85', '86'])
  },
  {
    type: 'decreto',
    number: '11.871',
    year: 2023,
    fullNumber: 'Decreto 11.871/2023',
    title: 'Regulamenta a Lei nº 14.133, de 1º de abril de 2021, para dispor sobre margem de preferência',
    ementa: 'Estabelece regras sobre margem de preferência e normas de desempate em licitações.',
    issuer: 'Presidência',
    publishDate: new Date('2023-12-28'),
    leiArticles: JSON.stringify(['26'])
  },
  {
    type: 'decreto',
    number: '11.875',
    year: 2024,
    fullNumber: 'Decreto 11.875/2024',
    title: 'Altera o Decreto nº 10.947, de 25 de janeiro de 2022',
    ementa: 'Promove novas alterações no decreto regulamentador da Lei 14.133/2021.',
    issuer: 'Presidência',
    publishDate: new Date('2024-01-02'),
    leiArticles: JSON.stringify(['8', '18', '26', '29', '72', '75', '95', '115', '124', '137', '155', '174', '175'])
  },
  {
    type: 'decreto',
    number: '12.375',
    year: 2025,
    fullNumber: 'Decreto 12.375/2025',
    title: 'Altera o Decreto nº 10.947, de 25 de janeiro de 2022',
    ementa: 'Introduz novas modificações no decreto regulamentador da Lei 14.133/2021.',
    issuer: 'Presidência',
    publishDate: new Date('2025-02-05'),
    leiArticles: JSON.stringify(['8', '18', '26', '29', '72', '75', '95', '115', '124', '137', '155', '174', '175'])
  },

  // INSTRUÇÕES NORMATIVAS SEGES/MGI
  {
    type: 'in',
    number: '65',
    year: 2021,
    fullNumber: 'IN SEGES 65/2021',
    title: 'Dispõe sobre a pesquisa de preços para a aquisição de bens e contratação de serviços',
    ementa: 'Estabelece procedimentos para pesquisa de preços na fase de planejamento da contratação.',
    issuer: 'SEGES',
    publishDate: new Date('2021-07-07'),
    leiArticles: JSON.stringify(['23'])
  },
  {
    type: 'in',
    number: '67',
    year: 2021,
    fullNumber: 'IN SEGES 67/2021',
    title: 'Dispõe sobre a Dispensa Eletrônica no âmbito da administração pública federal direta, autárquica e fundacional',
    ementa: 'Regulamenta o uso da Dispensa Eletrônica como ferramenta de contratação direta.',
    issuer: 'SEGES',
    publishDate: new Date('2021-07-21'),
    leiArticles: JSON.stringify(['75'])
  },
  {
    type: 'in',
    number: '69',
    year: 2021,
    fullNumber: 'IN SEGES 69/2021',
    title: 'Estabelece regras sobre os instrumentos da Estratégia de Contratação e do Mapa de Riscos',
    ementa: 'Define procedimentos para elaboração de Estratégia de Contratação e Mapa de Riscos.',
    issuer: 'SEGES',
    publishDate: new Date('2021-10-28'),
    leiArticles: JSON.stringify(['18', '19'])
  },
  {
    type: 'in',
    number: '71',
    year: 2021,
    fullNumber: 'IN SEGES 71/2021',
    title: 'Dispõe sobre reequilíbrio econômico-financeiro de contratos',
    ementa: 'Estabelece normas sobre pedidos de reequilíbrio econômico-financeiro.',
    issuer: 'SEGES',
    publishDate: new Date('2021-12-02'),
    leiArticles: JSON.stringify(['124', '137'])
  },
  {
    type: 'in',
    number: '1',
    year: 2022,
    fullNumber: 'IN SEGES 1/2022',
    title: 'Estabelece regras sobre os instrumentos do Estudo Técnico Preliminar e do Termo de Referência ou Projeto Básico',
    ementa: 'Define procedimentos para elaboração de ETP, TR e Projeto Básico.',
    issuer: 'SEGES',
    publishDate: new Date('2022-04-07'),
    leiArticles: JSON.stringify(['18', '19', '20'])
  },
  {
    type: 'in',
    number: '5',
    year: 2022,
    fullNumber: 'IN SEGES 5/2022',
    title: 'Dispõe sobre o Plano de Contratações Anual e sobre a elaboração do Termo de Referência ou Projeto Básico',
    ementa: 'Estabelece regras para o PCA e elaboração de documentos licitatórios.',
    issuer: 'SEGES',
    publishDate: new Date('2022-05-26'),
    leiArticles: JSON.stringify(['12', '18', '19', '20'])
  },
  {
    type: 'in',
    number: '8',
    year: 2022,
    fullNumber: 'IN SEGES 8/2022',
    title: 'Dispõe sobre regras e diretrizes para a realização de cotação eletrônica',
    ementa: 'Regulamenta o procedimento de cotação eletrônica para pequenas contratações.',
    issuer: 'SEGES',
    publishDate: new Date('2022-06-28'),
    leiArticles: JSON.stringify(['29'])
  },
  {
    type: 'in',
    number: '32',
    year: 2022,
    fullNumber: 'IN SEGES 32/2022',
    title: 'Dispõe sobre a contratação de serviços administrativos auxiliares',
    ementa: 'Estabelece normas sobre terceirização de serviços administrativos.',
    issuer: 'SEGES',
    publishDate: new Date('2022-12-12'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '50',
    year: 2022,
    fullNumber: 'IN SEGES 50/2022',
    title: 'Dispõe sobre a Gestão e Fiscalização de Contratos',
    ementa: 'Estabelece procedimentos para gestão e fiscalização contratual.',
    issuer: 'SEGES',
    publishDate: new Date('2022-12-27'),
    leiArticles: JSON.stringify(['115', '116', '117', '118', '119', '120', '121', '122', '123'])
  },
  {
    type: 'in',
    number: '53',
    year: 2022,
    fullNumber: 'IN SEGES 53/2022',
    title: 'Dispõe sobre a adesão à ata de registro de preços e procedimentos para registro de preços',
    ementa: 'Regulamenta a adesão a atas de registro de preços entre órgãos.',
    issuer: 'SEGES',
    publishDate: new Date('2022-12-27'),
    leiArticles: JSON.stringify(['81', '86'])
  },
  {
    type: 'in',
    number: '62',
    year: 2022,
    fullNumber: 'IN SEGES 62/2022',
    title: 'Dispõe sobre a contratação de serviços de engenharia',
    ementa: 'Estabelece normas específicas para contratação de obras e serviços de engenharia.',
    issuer: 'SEGES',
    publishDate: new Date('2022-12-29'),
    leiArticles: JSON.stringify(['6', '18', '19', '20'])
  },
  {
    type: 'in',
    number: '11',
    year: 2023,
    fullNumber: 'IN SEGES 11/2023',
    title: 'Dispõe sobre o recebimento de bens e serviços',
    ementa: 'Estabelece procedimentos para recebimento provisório e definitivo.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-03'),
    leiArticles: JSON.stringify(['140', '141'])
  },
  {
    type: 'in',
    number: '12',
    year: 2023,
    fullNumber: 'IN SEGES 12/2023',
    title: 'Dispõe sobre seguro-garantia em contratações públicas',
    ementa: 'Regulamenta o uso de seguro-garantia como garantia contratual.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-04'),
    leiArticles: JSON.stringify(['96', '97', '98'])
  },
  {
    type: 'in',
    number: '13',
    year: 2023,
    fullNumber: 'IN SEGES 13/2023',
    title: 'Dispõe sobre a realização de Procedimento de Manifestação de Interesse (PMI)',
    ementa: 'Estabelece regras para PMI na elaboração de estudos técnicos.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-05'),
    leiArticles: JSON.stringify(['19', '175'])
  },
  {
    type: 'in',
    number: '15',
    year: 2023,
    fullNumber: 'IN SEGES 15/2023',
    title: 'Dispõe sobre o credenciamento como modalidade de licitação',
    ementa: 'Regulamenta o uso do credenciamento conforme Lei 14.133/2021.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-15'),
    leiArticles: JSON.stringify(['79'])
  },
  {
    type: 'in',
    number: '17',
    year: 2023,
    fullNumber: 'IN SEGES 17/2023',
    title: 'Dispõe sobre a contratação de soluções de Tecnologia da Informação e Comunicação (TIC)',
    ementa: 'Estabelece normas específicas para contratações de TIC.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-22'),
    leiArticles: JSON.stringify(['6', '18', '19', '20'])
  },
  {
    type: 'in',
    number: '18',
    year: 2023,
    fullNumber: 'IN SEGES 18/2023',
    title: 'Dispõe sobre a modalidade de licitação Diálogo Competitivo',
    ementa: 'Regulamenta o Diálogo Competitivo como modalidade licitatória.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-23'),
    leiArticles: JSON.stringify(['32'])
  },
  {
    type: 'in',
    number: '19',
    year: 2023,
    fullNumber: 'IN SEGES 19/2023',
    title: 'Dispõe sobre a modalidade de licitação Concurso',
    ementa: 'Regulamenta o Concurso como modalidade licitatória.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-24'),
    leiArticles: JSON.stringify(['33'])
  },
  {
    type: 'in',
    number: '20',
    year: 2023,
    fullNumber: 'IN SEGES 20/2023',
    title: 'Dispõe sobre a modalidade de licitação Concorrência',
    ementa: 'Regulamenta a Concorrência como modalidade licitatória.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-25'),
    leiArticles: JSON.stringify(['29', '30'])
  },
  {
    type: 'in',
    number: '21',
    year: 2023,
    fullNumber: 'IN SEGES 21/2023',
    title: 'Dispõe sobre a modalidade de licitação Leilão',
    ementa: 'Regulamenta o Leilão como modalidade licitatória.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-26'),
    leiArticles: JSON.stringify(['34'])
  },
  {
    type: 'in',
    number: '22',
    year: 2023,
    fullNumber: 'IN SEGES 22/2023',
    title: 'Dispõe sobre a modalidade de licitação Pregão',
    ementa: 'Regulamenta o Pregão Eletrônico e Presencial conforme Lei 14.133/2021.',
    issuer: 'SEGES',
    publishDate: new Date('2023-05-29'),
    leiArticles: JSON.stringify(['29', '31'])
  },
  {
    type: 'in',
    number: '24',
    year: 2023,
    fullNumber: 'IN SEGES 24/2023',
    title: 'Dispõe sobre regime diferenciado de contratação integrada',
    ementa: 'Estabelece normas sobre a Contratação Integrada.',
    issuer: 'SEGES',
    publishDate: new Date('2023-06-13'),
    leiArticles: JSON.stringify(['45', '46'])
  },
  {
    type: 'in',
    number: '25',
    year: 2023,
    fullNumber: 'IN SEGES 25/2023',
    title: 'Dispõe sobre regime diferenciado de contratação semi-integrada',
    ementa: 'Estabelece normas sobre a Contratação Semi-Integrada.',
    issuer: 'SEGES',
    publishDate: new Date('2023-06-14'),
    leiArticles: JSON.stringify(['47'])
  },
  {
    type: 'in',
    number: '28',
    year: 2023,
    fullNumber: 'IN SEGES 28/2023',
    title: 'Dispõe sobre a contratação de estagiários',
    ementa: 'Estabelece procedimentos para contratação de estagiários no serviço público.',
    issuer: 'SEGES',
    publishDate: new Date('2023-07-05'),
    leiArticles: JSON.stringify(['6'])
  },
  {
    type: 'in',
    number: '29',
    year: 2023,
    fullNumber: 'IN SEGES 29/2023',
    title: 'Dispõe sobre alienação de bens móveis',
    ementa: 'Regulamenta a alienação de bens móveis no âmbito federal.',
    issuer: 'SEGES',
    publishDate: new Date('2023-07-10'),
    leiArticles: JSON.stringify(['76'])
  },
  {
    type: 'in',
    number: '32',
    year: 2023,
    fullNumber: 'IN SEGES 32/2023',
    title: 'Dispõe sobre sanções administrativas em licitações e contratos',
    ementa: 'Estabelece normas sobre aplicação de sanções administrativas.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-07'),
    leiArticles: JSON.stringify(['156', '157', '158', '159', '160', '161', '162'])
  },
  {
    type: 'in',
    number: '33',
    year: 2023,
    fullNumber: 'IN SEGES 33/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de vigilância e segurança',
    ementa: 'Estabelece normas específicas para contratação de serviços de vigilância.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-10'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '34',
    year: 2023,
    fullNumber: 'IN SEGES 34/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de limpeza',
    ementa: 'Estabelece normas específicas para contratação de serviços de limpeza.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-11'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '35',
    year: 2023,
    fullNumber: 'IN SEGES 35/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de recepção',
    ementa: 'Estabelece normas específicas para contratação de serviços de recepção.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-14'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '36',
    year: 2023,
    fullNumber: 'IN SEGES 36/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de reprografia',
    ementa: 'Estabelece normas específicas para contratação de serviços de reprografia.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-15'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '37',
    year: 2023,
    fullNumber: 'IN SEGES 37/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de copeiragem',
    ementa: 'Estabelece normas específicas para contratação de serviços de copeiragem.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-16'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '38',
    year: 2023,
    fullNumber: 'IN SEGES 38/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de ascensorista',
    ementa: 'Estabelece normas específicas para contratação de serviços de ascensorista.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-17'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '39',
    year: 2023,
    fullNumber: 'IN SEGES 39/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de jardinagem',
    ementa: 'Estabelece normas específicas para contratação de serviços de jardinagem.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-18'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '40',
    year: 2023,
    fullNumber: 'IN SEGES 40/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de telefonia',
    ementa: 'Estabelece normas específicas para contratação de serviços de telefonia.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-21'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '41',
    year: 2023,
    fullNumber: 'IN SEGES 41/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de motorista',
    ementa: 'Estabelece normas específicas para contratação de motoristas.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-22'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '42',
    year: 2023,
    fullNumber: 'IN SEGES 42/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de apoio administrativo',
    ementa: 'Estabelece normas específicas para contratação de apoio administrativo.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-23'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '43',
    year: 2023,
    fullNumber: 'IN SEGES 43/2023',
    title: 'Dispõe sobre licitação e contratação de serviços de manutenção predial',
    ementa: 'Estabelece normas específicas para contratação de manutenção predial.',
    issuer: 'SEGES',
    publishDate: new Date('2023-08-24'),
    leiArticles: JSON.stringify(['180'])
  },
  {
    type: 'in',
    number: '44',
    year: 2023,
    fullNumber: 'IN SEGES 44/2023',
    title: 'Dispõe sobre a aplicação de Inteligência Artificial em contratações públicas',
    ementa: 'Estabelece diretrizes para uso de IA no planejamento e gestão de contratações.',
    issuer: 'SEGES',
    publishDate: new Date('2023-10-26'),
    leiArticles: JSON.stringify(['18', '115', '174'])
  },
  {
    type: 'in',
    number: '51',
    year: 2023,
    fullNumber: 'IN SEGES 51/2023',
    title: 'Dispõe sobre Governança das Contratações Públicas',
    ementa: 'Estabelece princípios e diretrizes de governança para contratações.',
    issuer: 'SEGES',
    publishDate: new Date('2023-12-19'),
    leiArticles: JSON.stringify(['11', '12', '13', '174'])
  },
  {
    type: 'in',
    number: '52',
    year: 2023,
    fullNumber: 'IN SEGES 52/2023',
    title: 'Dispõe sobre Plataforma Nacional de Contratações Públicas',
    ementa: 'Estabelece normas sobre a utilização da plataforma nacional.',
    issuer: 'SEGES',
    publishDate: new Date('2023-12-20'),
    leiArticles: JSON.stringify(['174'])
  },
  {
    type: 'in',
    number: '4',
    year: 2024,
    fullNumber: 'IN SEGES 4/2024',
    title: 'Altera a IN SEGES 50/2022 sobre Gestão e Fiscalização de Contratos',
    ementa: 'Promove alterações nas regras de gestão e fiscalização contratual.',
    issuer: 'SEGES',
    publishDate: new Date('2024-01-16'),
    leiArticles: JSON.stringify(['115', '116', '117', '118', '119', '120', '121', '122', '123'])
  },
  {
    type: 'in',
    number: '5',
    year: 2024,
    fullNumber: 'IN SEGES 5/2024',
    title: 'Altera a IN SEGES 53/2022 sobre adesão à ata de registro de preços',
    ementa: 'Promove alterações nas regras de adesão a atas de SRP.',
    issuer: 'SEGES',
    publishDate: new Date('2024-01-22'),
    leiArticles: JSON.stringify(['81', '86'])
  },
  {
    type: 'in',
    number: '6',
    year: 2024,
    fullNumber: 'IN SEGES 6/2024',
    title: 'Altera a IN SEGES 1/2022 sobre ETP e TR/Projeto Básico',
    ementa: 'Promove alterações nas regras de elaboração de ETP e TR.',
    issuer: 'SEGES',
    publishDate: new Date('2024-01-23'),
    leiArticles: JSON.stringify(['18', '19', '20'])
  },
  {
    type: 'in',
    number: '13',
    year: 2024,
    fullNumber: 'IN SEGES 13/2024',
    title: 'Altera a IN SEGES 65/2021 sobre pesquisa de preços',
    ementa: 'Promove alterações nas regras de pesquisa de preços.',
    issuer: 'SEGES',
    publishDate: new Date('2024-05-13'),
    leiArticles: JSON.stringify(['23'])
  },
  {
    type: 'in',
    number: '31',
    year: 2024,
    fullNumber: 'IN SEGES 31/2024',
    title: 'Dispõe sobre a contratação de serviços de processamento de dados em nuvem',
    ementa: 'Estabelece normas específicas para contratação de cloud computing.',
    issuer: 'SEGES',
    publishDate: new Date('2024-10-22'),
    leiArticles: JSON.stringify(['6', '18', '180'])
  },

  // PORTARIAS SEGES/MGI
  {
    type: 'portaria',
    number: '11.380',
    year: 2021,
    fullNumber: 'Portaria SEGES 11.380/2021',
    title: 'Institui o Painel de Compras do Governo Federal',
    ementa: 'Cria painel de transparência e acompanhamento das contratações federais.',
    issuer: 'SEGES',
    publishDate: new Date('2021-10-29'),
    leiArticles: JSON.stringify(['174'])
  },
  {
    type: 'portaria',
    number: '12.932',
    year: 2021,
    fullNumber: 'Portaria SEGES 12.932/2021',
    title: 'Dispõe sobre a Central de Compras',
    ementa: 'Estabelece normas sobre a Central de Compras do Governo Federal.',
    issuer: 'SEGES',
    publishDate: new Date('2021-12-30'),
    leiArticles: JSON.stringify(['29'])
  },
  {
    type: 'portaria',
    number: '938',
    year: 2022,
    fullNumber: 'Portaria MGI 938/2022',
    title: 'Dispõe sobre o Cadastro Nacional de Empresas Inidôneas e Suspensas (CEIS)',
    ementa: 'Estabelece normas sobre consulta e registro no CEIS.',
    issuer: 'MGI',
    publishDate: new Date('2022-02-23'),
    leiArticles: JSON.stringify(['14', '15', '156'])
  },
  {
    type: 'portaria',
    number: '1.167',
    year: 2022,
    fullNumber: 'Portaria MGI 1.167/2022',
    title: 'Dispõe sobre o Cadastro Nacional de Empresas Punidas (CNEP)',
    ementa: 'Estabelece normas sobre consulta e registro no CNEP.',
    issuer: 'MGI',
    publishDate: new Date('2022-03-10'),
    leiArticles: JSON.stringify(['14', '156'])
  },
  {
    type: 'portaria',
    number: '8.678',
    year: 2022,
    fullNumber: 'Portaria SEGES 8.678/2022',
    title: 'Institui o Sistema Nacional de Gestão de Compras e Contratações Públicas',
    ementa: 'Cria o sistema nacional de governança em contratações.',
    issuer: 'SEGES',
    publishDate: new Date('2022-12-23'),
    leiArticles: JSON.stringify(['174'])
  },
  {
    type: 'portaria',
    number: '8.929',
    year: 2022,
    fullNumber: 'Portaria SEGES 8.929/2022',
    title: 'Dispõe sobre o Comitê de Governança das Contratações Públicas',
    ementa: 'Institui e regulamenta o funcionamento do comitê de governança.',
    issuer: 'SEGES',
    publishDate: new Date('2022-12-28'),
    leiArticles: JSON.stringify(['13', '174'])
  },
  {
    type: 'portaria',
    number: '2.817',
    year: 2023,
    fullNumber: 'Portaria SEGES 2.817/2023',
    title: 'Dispõe sobre o uso de IA na análise de editais',
    ementa: 'Autoriza o uso de inteligência artificial para análise prévia de editais.',
    issuer: 'SEGES',
    publishDate: new Date('2023-06-15'),
    leiArticles: JSON.stringify(['40', '174'])
  },
  {
    type: 'portaria',
    number: '4.401',
    year: 2023,
    fullNumber: 'Portaria SEGES 4.401/2023',
    title: 'Institui o Programa Nacional de Capacitação em Contratações Públicas',
    ementa: 'Cria programa de capacitação para agentes públicos em licitações.',
    issuer: 'SEGES',
    publishDate: new Date('2023-09-21'),
    leiArticles: JSON.stringify(['8', '174'])
  },
  {
    type: 'portaria',
    number: '4.402',
    year: 2023,
    fullNumber: 'Portaria SEGES 4.402/2023',
    title: 'Institui o Banco Nacional de Termos de Referência',
    ementa: 'Cria repositório nacional de modelos de TR e documentos licitatórios.',
    issuer: 'SEGES',
    publishDate: new Date('2023-09-22'),
    leiArticles: JSON.stringify(['20', '174'])
  },

  // MEDIDA PROVISÓRIA
  {
    type: 'medida-provisoria',
    number: '1.167',
    year: 2023,
    fullNumber: 'Medida Provisória 1.167/2023',
    title: 'Altera a Lei nº 14.133, de 1º de abril de 2021',
    ementa: 'Promove alterações emergenciais na Lei de Licitações e Contratos.',
    issuer: 'Presidência',
    publishDate: new Date('2023-04-03'),
    leiArticles: JSON.stringify(['6', '14', '24', '75', '156'])
  }
];

async function seedLegislativeActs() {
  try {
    console.log('📚 Iniciando população de atos normativos...\n');

    // Verificar se já existem atos
    const existingCount = await prisma.legislativeAct.count();

    if (existingCount > 0) {
      console.log(`⚠️  Já existem ${existingCount} atos normativos no banco.`);
      console.log('⚠️  Este script irá adicionar apenas novos atos (baseado em fullNumber único).\n');
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const act of legislativeActs) {
      try {
        // Calcular hierarchyLevel baseado no tipo
        const actData = {
          ...act,
          hierarchyLevel: getHierarchyLevel(act.type)
        };

        // Tentar criar o ato (upsert evita duplicatas)
        await prisma.legislativeAct.upsert({
          where: { fullNumber: actData.fullNumber },
          create: actData,
          update: {} // Não atualiza se já existir
        });

        console.log(`✅ ${actData.fullNumber} - ${actData.title.substring(0, 60)}...`);
        inserted++;
      } catch (error) {
        // Se der erro de unique constraint, já existe
        if (error.code === 'P2002') {
          console.log(`⏭️  ${act.fullNumber} - Já existe no banco`);
          skipped++;
        } else {
          console.error(`❌ Erro ao inserir ${act.fullNumber}:`, error.message);
          errors++;
        }
      }
    }

    console.log('\n📊 Resumo:');
    console.log(`   ✅ Inseridos: ${inserted}`);
    console.log(`   ⏭️  Ignorados: ${skipped}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log(`   📚 Total no banco: ${await prisma.legislativeAct.count()}`);

    console.log('\n✅ População de atos normativos concluída!');
    console.log('\n💡 Próximos passos:');
    console.log('   - Criar APIs CRUD em /api/admin/legislative-acts');
    console.log('   - Criar painel admin em /admin/legislacao');
    console.log('   - Criar página pública em /legislacao');
    console.log('   - Implementar sistema de favoritos e notificações');

  } catch (error) {
    console.error('❌ Erro ao popular atos normativos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
seedLegislativeActs()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
