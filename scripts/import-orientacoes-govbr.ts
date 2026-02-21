import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

interface OrientacaoData {
  title: string;
  description: string;
  url: string;
  tags: string[];
}

// ========================================
// 44 Orientações e Procedimentos
// ========================================
const orientacoes: OrientacaoData[] = [
  {
    title: 'Orientação nº 1 — Desfazimento de Bens de Informática',
    description: 'Orientação sobre procedimentos para desfazimento de bens de informática no âmbito da Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/desfazimento-de-bens-de-informatica',
    tags: ['desfazimento', 'bens', 'informática', 'patrimônio'],
  },
  {
    title: 'Orientação nº 2 — Desoneração de Folha de Pagamento (Acórdão TCU 2.859/2013)',
    description: 'Orientação sobre a desoneração de folha de pagamento em contratos de serviços terceirizados, com base no Acórdão nº 2.859/2013 do TCU.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/2-orientacao-sobre-a-desoneracao-de-folha-de-pagamento-acordao-no-2-859-2013-tcu',
    tags: ['desoneração', 'folha de pagamento', 'terceirização', 'TCU'],
  },
  {
    title: 'Orientação nº 3 — Contratação de Serviços de Vigilância Noturna',
    description: 'Orientação aos gestores sobre procedimentos para contratação de serviços de vigilância noturna na Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/3-orientacao-aos-gestores',
    tags: ['vigilância', 'serviços', 'terceirização', 'segurança'],
  },
  {
    title: 'Orientação nº 4 — Cronograma de Previsão de Empenho (CPE) — Unidades SISG',
    description: 'Orientação sobre o Cronograma de Previsão de Empenho (CPE) para unidades integrantes do Sistema de Serviços Gerais (SISG).',
    url: 'https://www.gov.br/compras/pt-br/centrais-de-conteudo/orientacoes-e-procedimentos/orientao-usurio-17082017.pdf/view',
    tags: ['empenho', 'CPE', 'SISG', 'orçamento'],
  },
  {
    title: 'Orientação nº 5 — Cronograma de Previsão de Empenho (CPE) — Unidades não SISG',
    description: 'Orientação sobre o Cronograma de Previsão de Empenho (CPE) para unidades não integrantes do SISG, conforme Decreto nº 9.046/2017.',
    url: 'https://www.gov.br/compras/pt-br/centrais-de-conteudo/orientacoes-e-procedimentos/orientao-cpe-no-sisg-decreto-9046-2017-no-registro-do-contrato-entidade-no-sisg.pdf/view',
    tags: ['empenho', 'CPE', 'orçamento', 'Decreto 9.046'],
  },
  {
    title: 'Orientação nº 6 — Agricultura Familiar nas Compras Públicas',
    description: 'Orientação sobre a aquisição de gêneros alimentícios da agricultura familiar para a alimentação escolar e demais programas da Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/6-agricultura-familiar',
    tags: ['agricultura familiar', 'alimentação', 'compras públicas', 'sustentabilidade'],
  },
  {
    title: 'Orientação nº 7 — Aplicação do Decreto nº 8.538/2015 (ME e EPP)',
    description: 'Orientação aos gestores para aplicação do Decreto nº 8.538/2015, que regulamenta o tratamento favorecido, diferenciado e simplificado para microempresas e empresas de pequeno porte nas licitações.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/7-orientacao-aos-gestores-para-aplicacao-do-decreto-no-8-538-2015',
    tags: ['ME', 'EPP', 'microempresa', 'tratamento diferenciado', 'licitações'],
  },
  {
    title: 'Orientação nº 8 — Impactos da Reforma Trabalhista nos Contratos Administrativos',
    description: 'Orientação sobre os impactos da reforma trabalhista (Lei nº 13.467/2017) nos contratos de prestação de serviços com dedicação exclusiva de mão de obra da Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/impactos-da-reforma-trabalhista-nos-contratos-da-administracao',
    tags: ['reforma trabalhista', 'contratos', 'terceirização', 'mão de obra'],
  },
  {
    title: 'Orientação nº 9 — Portaria nº 6/2018 — Transporte de Servidores (TaxiGov)',
    description: 'Orientação sobre a Portaria nº 6/2018, que dispõe sobre o serviço de transporte terrestre administrativo de servidores públicos por meio do programa TaxiGov.',
    url: 'https://www.gov.br/compras/pt-br/centrais-de-conteudo/orientacoes-e-procedimentos/midia/anexo-of-521-1-1.pdf/view',
    tags: ['transporte', 'TaxiGov', 'servidores', 'logística'],
  },
  {
    title: 'Orientação nº 10 — Contratação de Soluções de TIC',
    description: 'Orientação para contratação de soluções de Tecnologia da Informação e Comunicação (TIC) no âmbito da Administração Pública Federal, com diretrizes da Secretaria de Governo Digital.',
    url: 'https://www.gov.br/governodigital/pt-br/contratacoes',
    tags: ['TIC', 'tecnologia', 'governo digital', 'contratação'],
  },
  {
    title: 'Orientação nº 11 — Planilha de Custos e Formação de Preços',
    description: 'Orientações gerais para elaboração da planilha de custos e formação de preços em contratações de serviços terceirizados com dedicação exclusiva de mão de obra.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/11-orientacoes-gerais-para-planilha-de-custos-e-formacao-de-precos',
    tags: ['planilha de custos', 'formação de preços', 'terceirização', 'mão de obra'],
  },
  {
    title: 'Orientação nº 12 — Fluxos de Planejamento e Fiscalização de Contratações',
    description: 'Fluxos dos processos de planejamento da contratação e fiscalização de serviços terceirizados, conforme a Instrução Normativa de Serviços.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/fluxos-dos-processos-de-planejamento-da-contratacao-e-fiscalizacao-aos-moldes-da-instrucao-normativa-de-servicos',
    tags: ['planejamento', 'fiscalização', 'fluxos', 'terceirização'],
  },
  {
    title: 'Orientação nº 13 — Registro de Preços: Novas Regras',
    description: 'Orientações gerais sobre as novas regras para contratação por sistema de registro de preços na Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/13-orientacoes-gerais-sobre-novas-regras-para-contratacao-por-registro-de-precos',
    tags: ['registro de preços', 'SRP', 'licitações', 'ata de registro'],
  },
  {
    title: 'Orientação nº 14 — Utilização do SCDP por Terceirizados',
    description: 'Orientação sobre a utilização do Sistema de Concessão de Diárias e Passagens (SCDP) por empregados terceirizados em contratos da Administração Pública.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/14-orientacao-sobre-a-utilizacao-do-scdp-por-terceirizados',
    tags: ['SCDP', 'diárias', 'passagens', 'terceirizados', 'viagens'],
  },
  {
    title: 'Orientação nº 15 — Elaboração dos Planos Anuais de Contratações 2020',
    description: 'Orientações sobre a elaboração dos Planos Anuais de Contratações de 2020, com procedimentos e prazos para os órgãos da Administração Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/15-aviso-importante-orientacoes-sobre-a-elaboracao-dos-planos-anuais-de-contratacoes-de-2020',
    tags: ['PCA', 'plano de contratações', 'planejamento', 'programação'],
  },
  {
    title: 'Orientação nº 16 — Sistema Integrado de Gestão Patrimonial (SIADS)',
    description: 'Orientação sobre o Sistema Integrado de Gestão Patrimonial (SIADS) e sua utilização para controle de bens patrimoniais na Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/16-orientacao-sobre-sistema-integrado-de-gestao-patrimonial-2013-siads',
    tags: ['SIADS', 'patrimônio', 'gestão patrimonial', 'bens'],
  },
  {
    title: 'Orientação nº 17 — Submódulo 2.1 da Planilha de Formação de Preços',
    description: 'Orientação sobre o preenchimento do Submódulo 2.1 (13º salário, férias e adicional de férias) da Planilha de Formação de Preços para serviços terceirizados.',
    url: 'https://www.gov.br/compras/pt-br/centrais-de-conteudo/orientacoes-e-procedimentos/midia/nota-informativa-submdulo-2-1.pdf/view',
    tags: ['planilha de preços', 'submódulo 2.1', '13º salário', 'férias', 'terceirização'],
  },
  {
    title: 'Orientação nº 18 — Contratos de Limpeza e Conservação (IN nº 2/2008)',
    description: 'Orientação sobre contratos de limpeza e conservação firmados com base na Instrução Normativa nº 2, de 2008, incluindo aspectos de repactuação e reajuste.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/18-orientacao-sobre-contratos-de-limpeza-e-conservacao-firmados-com-base-na-instrucao-normativa-no-2-de-2008',
    tags: ['limpeza', 'conservação', 'terceirização', 'repactuação'],
  },
  {
    title: 'Orientação nº 19 — PIS e COFINS em Contratações de Serviços',
    description: 'Orientações sobre a incidência de PIS e COFINS em contratações de prestação de serviços com dedicação exclusiva de mão de obra na Administração Pública.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/19-orientacoes-sobre-pis-e-cofins-em-contratacoes-de-prestacao-de-servicos-com-dedicacao-exclusiva-de-mao-de-obra',
    tags: ['PIS', 'COFINS', 'tributário', 'terceirização', 'mão de obra'],
  },
  {
    title: 'Orientação nº 20 — Locação de Imóveis pela Administração Pública',
    description: 'Orientação sobre os procedimentos para locação de imóveis pela Administração Pública Federal, incluindo dispensa de licitação e avaliação prévia.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/20-orientacao-sobre-locacao-de-imoveis',
    tags: ['locação', 'imóveis', 'dispensa', 'avaliação'],
  },
  {
    title: 'Orientação nº 21 — Direito de Preferência em Contratações de TIC',
    description: 'Orientação sobre a aplicação do direito de preferência nas contratações de serviços de tecnologia da informação associados ao fornecimento ou locação de bens.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/21-orientacao-sobre-a-aplicacao-do-direito-de-preferencia-nas-contratacoes-de-servicos-de-tecnologia-da-informacao-associados-ao-fornecimento-ou-locacao-de-bens',
    tags: ['TIC', 'preferência', 'tecnologia', 'bens de informática'],
  },
  {
    title: 'Orientação nº 22 — Cotação Eletrônica em Dispensa de Licitação',
    description: 'Orientação sobre a utilização da cotação eletrônica nos casos de dispensa de licitação na Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/22-orientacao-sobre-a-utilizacao-da-cotacao-eletronica-no-caso-de-dispensa-de-licitacao',
    tags: ['cotação eletrônica', 'dispensa', 'licitação', 'compras diretas'],
  },
  {
    title: 'Orientação nº 23 — Publicação de Atos Administrativos de Licitação',
    description: 'Orientação sobre a publicação dos atos administrativos de licitação, incluindo editais, resultados e atos de adjudicação e homologação.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/23-orientacao-sobre-publicacao-dos-atos-administrativos-de-licitacao',
    tags: ['publicação', 'edital', 'licitação', 'DOU', 'transparência'],
  },
  {
    title: 'Orientação nº 24 — Item 10.10 do Anexo VII-A da IN 5/2017',
    description: 'Orientação sobre o item 10.10 do Anexo VII-A da Instrução Normativa nº 5/2017 (SEGES), referente à gestão e fiscalização de contratos de serviços.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/24-orientacao-sobre-o-item-10-10-do-anexo-vii-a-da-in-5-2017',
    tags: ['IN 5/2017', 'fiscalização', 'contratos', 'serviços'],
  },
  {
    title: 'Orientação nº 25 — Desfazimento de Bens',
    description: 'Orientação sobre o desfazimento de bens no âmbito da Administração Pública Federal, incluindo alienação, transferência e inutilização.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/25-orientacao-sobre-desfazimento-de-bens',
    tags: ['desfazimento', 'bens', 'alienação', 'patrimônio'],
  },
  {
    title: 'Orientação nº 26 — Extinção da Contribuição Social de 10% sobre FGTS',
    description: 'Orientação sobre a extinção da contribuição social de 10% sobre o FGTS e seus impactos nos contratos administrativos de serviços terceirizados.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/26-extincao-da-contribuicao-social-de-10-sobre-o-fgts-e-os-contratos-administrativos',
    tags: ['FGTS', 'contribuição social', 'terceirização', 'contratos'],
  },
  {
    title: 'Orientação nº 27 — Contratação de Leiloeiros',
    description: 'Orientação sobre os procedimentos para contratação de leiloeiros oficiais pela Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/27-orientacao-sobre-contratacao-de-leiloeiros',
    tags: ['leiloeiro', 'leilão', 'alienação', 'contratação'],
  },
  {
    title: 'Orientação nº 28 — Valores Limites Referenciais de 2020',
    description: 'Orientação sobre os valores limites referenciais de 2020 para contratação de serviços de vigilância, limpeza e conservação na Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/28-orientacao-sobre-os-valores-limites-referenciais-de-2020',
    tags: ['valores limites', 'vigilância', 'limpeza', 'referenciais de preço'],
  },
  {
    title: 'Orientação nº 29 — Tratamento de Risco e Custos Renováveis na Conta-Depósito Vinculada',
    description: 'Ferramentas para o tratamento de risco e os custos renováveis na Conta-Depósito Vinculada, com modelo de planilha de custo e formação de preços.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/29-ferramentas-para-o-tratamento-de-risco-e-os-custos-renovaveis-na-conta-deposito-vinculada-2013-planilha-de-custo-e-formacao-de-precos',
    tags: ['conta vinculada', 'risco', 'custos renováveis', 'planilha de preços'],
  },
  {
    title: 'Orientação nº 30 — Contratação de Instituição sem Fins Lucrativos (Acórdão TCU 2.426/2020)',
    description: 'Orientação sobre a contratação de instituição sem fins lucrativos pela Administração Pública, com base no Acórdão nº 2.426/2020 do TCU-Plenário.',
    url: 'https://www.gov.br/compras/pt-br/acesso-a-informacao/noticias/orientacao-sobre-contratacao-de-instituicao-sem-fins-lucrativos-acordao-no-2-426-2020-tcu-plenario',
    tags: ['sem fins lucrativos', 'contratação direta', 'TCU', 'dispensa'],
  },
  {
    title: 'Orientação nº 31 — AntecipaGov',
    description: 'Orientação sobre o programa AntecipaGov, que possibilita a antecipação de recebíveis de fornecedores do Governo Federal em contratos administrativos.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/31-orientacao-2013-antecipagov',
    tags: ['AntecipaGov', 'antecipação', 'recebíveis', 'fornecedores'],
  },
  {
    title: 'Orientação nº 32 — Comunicado AntecipaGov para Fornecedores e Instituições Financeiras',
    description: 'Comunicado aos fornecedores, instituições gestoras de plataformas e instituições financeiras tipo I sobre o funcionamento do AntecipaGov.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/comunicado-aos-fornecedores-as-instituicoes-gestoras-das-plataformas-e-as-instituicoes-financeiras-tipo-i',
    tags: ['AntecipaGov', 'fornecedores', 'instituições financeiras', 'plataformas'],
  },
  {
    title: 'Orientação nº 33 — Pagamento Direto de Contribuições Previdenciárias e FGTS',
    description: 'Orientações sobre o pagamento direto de contribuições previdenciárias e de FGTS quando do inadimplemento por parte das empresas contratadas para prestação de serviços contínuos com dedicação exclusiva de mão de obra.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/33-orientacoes-sobre-o-pagamento-direto-de-contribuicoes-previdenciarias-e-de-fgts-quando-do-inadimplemento-por-parte-das-empresas-contratadas-para-a-prestacao-de-servicos-continuados-com-dedicacao-exclusiva-de-mao-de-obra',
    tags: ['previdência', 'FGTS', 'pagamento direto', 'inadimplemento', 'terceirização'],
  },
  {
    title: 'Orientação nº 34 — Fiança Bancária nos Contratos (Lei nº 8.666/1993)',
    description: 'Orientação sobre a utilização de fiança bancária como garantia nos contratos administrativos regidos pela Lei nº 8.666/1993.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/34-orientacao-sobre-fianca-bancaria-nos-contratos-regidos-pela-lei-no-8-666-de-1993',
    tags: ['fiança bancária', 'garantia', 'contratos', 'Lei 8.666'],
  },
  {
    title: 'Orientação nº 35 — Estimativa de Valor Preliminar para PCA',
    description: 'Orientação sobre procedimento simplificado para estimar o valor preliminar da contratação para fins de inclusão no Plano de Contratações Anual (PCA).',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/35-orientacao-sobre-procedimento-simplificado-para-estimar-o-valor-preliminar-da-contratacao-para-plano-de-contratacoes-anual',
    tags: ['PCA', 'valor estimado', 'planejamento', 'contratações'],
  },
  {
    title: 'Orientação nº 36 — Uso de Código CATMAT/CATSER (Acórdão TCU 2.831/2021)',
    description: 'Recomendação sobre o uso de código específico do catálogo de bens e serviços (CATMAT/CATSER), com base no Acórdão nº 2.831/2021 do TCU-Plenário.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/36-recomendacao-sobre-uso-de-codigo-especifico-do-catalogo-de-bens-e-servicos-catmat-catser-2013-acordao-2831-2021-tcu-plenario',
    tags: ['CATMAT', 'CATSER', 'catálogo', 'bens', 'serviços', 'TCU'],
  },
  {
    title: 'Orientação nº 37 — Relatório de Gestão de Riscos do PCA',
    description: 'Orientações sobre o relatório de gestão de riscos do Plano de Contratações Anual (PCA), com diretrizes para identificação e mitigação de riscos.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/37-orientacoes-sobre-o-relatorio-de-gestao-de-riscos-do-plano-de-contratacoes-anual-2013-pca-1',
    tags: ['PCA', 'gestão de riscos', 'planejamento', 'controle'],
  },
  {
    title: 'Orientação nº 38 — Priorização da Dispensa Eletrônica',
    description: 'Recomendação sobre a priorização do uso da dispensa de licitação na sua forma eletrônica, conforme a Lei nº 14.133/2021.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/38-recomendacao-sobre-a-priorizacao-do-uso-da-dispensa-de-licitacao-na-sua-forma-eletronica',
    tags: ['dispensa eletrônica', 'licitação', 'compras diretas', 'Lei 14.133'],
  },
  {
    title: 'Orientação nº 39 — Normativo Interno para Processo de Trabalho do PCA',
    description: 'Orientação sobre a edição de normativo interno fixando o processo de trabalho para elaboração e execução dos Planos de Contratações Anuais (PCAs).',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/39-orientacao-sobre-a-edicao-de-normativo-interno-fixando-o-processo-de-trabalho-para-elaboracao-e-execucao-dos-pca2019s',
    tags: ['PCA', 'normativo interno', 'processo de trabalho', 'planejamento'],
  },
  {
    title: 'Orientação nº 40 — Priorização da Dispensa Eletrônica (Atualizada)',
    description: 'Recomendação atualizada sobre a priorização do uso da dispensa de licitação na sua forma eletrônica, com novos procedimentos.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/40-recomendacao-sobre-a-priorizacao-do-uso-da-dispensa-de-licitacao-na-sua-forma-eletronica-atualizada',
    tags: ['dispensa eletrônica', 'licitação', 'compras diretas', 'atualização'],
  },
  {
    title: 'Orientação nº 41 — Publicação dos Documentos do Processo de Contratação',
    description: 'Orientação sobre a publicação dos documentos que integram o processo de contratação pública, incluindo ETP, TR, edital e demais peças.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/41-orientacao-sobre-a-publicacao-dos-documentos-que-integram-o-processo-de-contratacao',
    tags: ['publicação', 'transparência', 'processo de contratação', 'ETP', 'TR'],
  },
  {
    title: 'Orientação nº 42 — Credenciamento para Contratação de Leiloeiro Oficial',
    description: 'Orientação sobre o procedimento de credenciamento para contratação de leiloeiro oficial pela Administração Pública, conforme a Lei nº 14.133/2021.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/42-orientacao-acerca-do-credenciamento-para-contratacao-de-leiloeiro-oficial',
    tags: ['credenciamento', 'leiloeiro', 'leilão', 'Lei 14.133'],
  },
  {
    title: 'Orientação nº 43 — Reoneração Gradual de Folha de Pagamento (Lei 14.973/2024)',
    description: 'Orientação sobre a reoneração gradual de folha de pagamento, conforme alterações da Lei nº 12.546/2011 pela Lei nº 14.973/2024, e seus reflexos nos contratos administrativos.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/43-orientacao-sobre-a-reoneracao-gradual-de-folha-de-pagamento-alteracoes-da-lei-no-12-546-de-14-de-dezembro-de-2011-pela-lei-14-973-de-16-de-setembro-de-2024',
    tags: ['reoneração', 'folha de pagamento', 'terceirização', 'Lei 14.973'],
  },
  {
    title: 'Orientação nº 44 — IN SEGES/MGI nº 213/2025 — Previsibilidade das Férias',
    description: 'Orientação sobre a Instrução Normativa SEGES/MGI nº 213, de 2025, que dispõe sobre a previsibilidade do gozo de férias dos empregados terceirizados com dedicação exclusiva de mão de obra.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/44-orientacao-sobre-a-in-seges-mgi-no-213-de-2025-2013-previsibilidade-das-ferias',
    tags: ['férias', 'terceirização', 'IN 213/2025', 'previsibilidade', 'mão de obra'],
  },
];

// ========================================
// 12 Cadernos de Logística
// ========================================
const cadernos: OrientacaoData[] = [
  {
    title: 'Caderno de Logística — Pesquisa de Preços (2023)',
    description: 'Caderno de logística sobre procedimentos e boas práticas para pesquisa de preços em contratações públicas, atualizado com base na Lei nº 14.133/2021 e IN SEGES/ME nº 65/2021.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/caderno-de-pesquisa-de-precos-2023_final.pdf/',
    tags: ['pesquisa de preços', 'caderno de logística', 'IN 65/2021', 'estimativa'],
  },
  {
    title: 'Caderno de Logística — Plano Diretor de Logística Sustentável (PLS)',
    description: 'Caderno de logística com orientações para elaboração do Plano Diretor de Logística Sustentável (PLS) no âmbito da Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/logistica-publica-sustentavel/plano-de-gestao-de-logistica-sustentaveis/plano-diretor-logistica-sustentavel-ver1.pdf',
    tags: ['logística sustentável', 'PLS', 'caderno de logística', 'sustentabilidade'],
  },
  {
    title: 'Caderno de Logística — Fato Gerador',
    description: 'Caderno de logística sobre o conceito e a aplicação do fato gerador na execução e fiscalização de contratos de serviços terceirizados.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/fato_gerador.pdf',
    tags: ['fato gerador', 'caderno de logística', 'fiscalização', 'execução contratual'],
  },
  {
    title: 'Caderno de Logística — Conta Vinculada',
    description: 'Caderno de logística sobre a conta-depósito vinculada para retenção e pagamento de encargos trabalhistas em contratos de serviços terceirizados.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/caderno_logistica_conta_vinculada.pdf',
    tags: ['conta vinculada', 'caderno de logística', 'encargos trabalhistas', 'terceirização'],
  },
  {
    title: 'Caderno de Logística — RDC (Regime Diferenciado de Contratações)',
    description: 'Caderno de logística sobre o Regime Diferenciado de Contratações Públicas (RDC) e suas especificidades.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/3_-caderno-de-logistica-_-rdc.pdf',
    tags: ['RDC', 'caderno de logística', 'contratações', 'regime diferenciado'],
  },
  {
    title: 'Caderno de Logística — Sanções Administrativas em Licitações e Contratos (Parte 1)',
    description: 'Caderno de logística sobre sanções administrativas aplicáveis a licitantes e contratados em licitações e contratos administrativos — Parte 1.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/manual-sancoes-22-09.pdf',
    tags: ['sanções', 'caderno de logística', 'penalidades', 'licitações', 'contratos'],
  },
  {
    title: 'Caderno de Logística — Sanções Administrativas em Licitações e Contratos (Parte 2)',
    description: 'Caderno de logística sobre sanções administrativas aplicáveis a licitantes e contratados em licitações e contratos administrativos — Parte 2.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/caderno-de-logistica-de-sancao-2.pdf',
    tags: ['sanções', 'caderno de logística', 'penalidades', 'licitações', 'contratos'],
  },
  {
    title: 'Caderno de Logística — Serviços de Transporte',
    description: 'Caderno de logística com orientações para contratação de serviços de transporte administrativo pela Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/servicos_transportes.pdf',
    tags: ['transporte', 'caderno de logística', 'serviços', 'logística'],
  },
  {
    title: 'Caderno de Logística — Serviços de Vigilância',
    description: 'Caderno de logística com orientações para contratação de serviços de vigilância patrimonial pela Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/servicos_vigilancia.pdf',
    tags: ['vigilância', 'caderno de logística', 'serviços', 'segurança patrimonial'],
  },
  {
    title: 'Caderno de Logística — Serviços de Limpeza e Conservação',
    description: 'Caderno de logística com orientações para contratação de serviços de limpeza e conservação pela Administração Pública Federal.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/servicos_limpeza.pdf',
    tags: ['limpeza', 'conservação', 'caderno de logística', 'serviços'],
  },
  {
    title: 'Caderno de Logística — Empresas Estrangeiras em Licitações Públicas',
    description: 'Caderno de logística com orientações sobre a participação de empresas estrangeiras em licitações públicas no Brasil.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/empresas-estrangeiras-em-licitacoes-publicas.pdf',
    tags: ['empresas estrangeiras', 'caderno de logística', 'licitações', 'habilitação'],
  },
  {
    title: 'Caderno de Logística — Implementação do Decreto nº 11.430/2023',
    description: 'Caderno de logística com orientações para implementação do Decreto nº 11.430/2023, que dispõe sobre a exigência de percentual mínimo de mão de obra feminina, incluindo mulheres vítimas de violência doméstica.',
    url: 'https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/caderno-logistica-decreto11430-ver1.pdf/',
    tags: ['Decreto 11.430', 'mão de obra feminina', 'caderno de logística', 'equidade'],
  },
];

async function main() {
  const allDocs = [...orientacoes, ...cadernos];
  console.log(`Inserindo ${allDocs.length} documentos (${orientacoes.length} orientações + ${cadernos.length} cadernos)...\n`);

  let created = 0;
  let skipped = 0;

  for (const doc of allDocs) {
    const existing = await prisma.document.findFirst({
      where: { title: doc.title },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] ${doc.title.substring(0, 70)}... (já existe)`);
      skipped++;
      continue;
    }

    await prisma.document.create({
      data: {
        title: doc.title,
        description: doc.description,
        type: 'link',
        url: doc.url,
        category: 'orientacao_procedimento',
        isPublic: true,
        isCommon: true,
        reviewed: true,
        reviewedAt: new Date(),
        issuerOrg: 'SEGES/MGI',
        esfera: 'federal',
        tags: JSON.stringify(doc.tags),
      },
    });

    console.log(`  [OK] ${doc.title.substring(0, 70)}...`);
    created++;
  }

  console.log(`\nResultado: ${created} criados, ${skipped} ignorados.`);

  const total = await prisma.document.count({
    where: { category: 'orientacao_procedimento' },
  });
  console.log(`Total de documentos "orientacao_procedimento" no banco: ${total}`);

  await prisma.$disconnect();
}

main().catch(console.error);
