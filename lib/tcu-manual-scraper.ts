/**
 * TCU Manual "Licitações & Contratos" Web Scraper
 *
 * Scrapes the TCU manual website (licitacoesecontratos.tcu.gov.br)
 * to import section content as searchable Documents.
 *
 * The manual is organized in ~160 individual pages, one per section,
 * covering all stages of public procurement under Lei 14.133/2021.
 */

import * as cheerio from 'cheerio';
import { computeHash } from '@/lib/legislative-scrapers/change-detector';
import { apiLogger } from "@/lib/logger";

const BASE_URL = 'https://licitacoesecontratos.tcu.gov.br';

export interface ManualSection {
  slug: string;
  sectionNumber: string;
  title: string;
}

export interface ScrapedPage {
  title: string;
  sectionNumber: string;
  content: string;
  description: string;
  leiArticles: number[];
  contentHash: string;
  url: string;
}

/**
 * All sections of the TCU Manual "Licitações & Contratos" (5ª Edição)
 * Ordered by section number. Slugs include WordPress suffixes (-2) where applicable.
 */
export const MANUAL_SECTIONS: ManualSection[] = [
  // O sitio publica esta sem numeracao. Nao se inventa numero: o campo fica
  // vazio e o titulo do documento sai sem prefixo.
  { slug: '137-2', sectionNumber: '', title: 'Licitacoes e Contratos' },
  // Fora da lista de proposito: /apresentacao/ nao expoe o conteudo pelo
  // seletor main-content-general, e o que ha nela descreve o formato digital
  // da obra, sem materia de licitacao. Mantida na lista, so gerava erro a
  // cada rodada. Apurado em 14 de agosto de 2026.
  { slug: '1-1-objetivo-e-escopo', sectionNumber: '1.1', title: 'Objetivo e escopo' },
  { slug: '1-2-organizacao-do-conteudo', sectionNumber: '1.2', title: 'Organização do conteúdo' },
  { slug: '2-governanca-das-contratacoes-publicas-2', sectionNumber: '2', title: 'Governança das contratações públicas' },
  { slug: '2-1-promocao-da-integridade-nas-contratacoes', sectionNumber: '2.1', title: 'Promoção da integridade nas contratações' },
  { slug: '2-2-gestao-de-riscos-das-contratacoes', sectionNumber: '2.2', title: 'Gestão de riscos das contratações' },
  { slug: '2-3-promocao-da-gestao-estrategica-das-contratacoes', sectionNumber: '2.3', title: 'Promoção da gestão estratégica das contratações' },
  { slug: '2-3-1-modelo-de-gestao-das-contratacoes', sectionNumber: '2.3.1', title: 'Modelo de gestão das contratações' },
  { slug: '2-3-1-1-estrutura-e-processos-de-trabalho', sectionNumber: '2.3.1.1', title: 'Estrutura e processos de trabalho' },
  { slug: '2-3-1-2-gestao-de-pessoas-na-funcao-de-contratacoes', sectionNumber: '2.3.1.2', title: 'Gestão de pessoas na função de contratações' },
  { slug: '2-3-1-3-demais-diretrizes-para-a-funcao-de-contratacoes', sectionNumber: '2.3.1.3', title: 'Demais diretrizes para a função de contratações' },
  { slug: '2-3-2-instrumentos-de-planejamento-da-funcao-de-contratacoes', sectionNumber: '2.3.2', title: 'Instrumentos de planejamento da função de contratações' },
  { slug: '2-3-2-1-objetivos-indicadores-e-metas-para-a-funcao-de-contratacoes', sectionNumber: '2.3.2.1', title: 'Objetivos, indicadores e metas para a função de contratações' },
  { slug: '2-3-2-2-plano-de-logistica-sustentavel-pls', sectionNumber: '2.3.2.2', title: 'Plano de logística sustentável (PLS)' },
  { slug: '2-3-2-3-plano-de-contratacoes-anual-pca', sectionNumber: '2.3.2.3', title: 'Plano de contratações anual (PCA)' },
  { slug: '2-4-monitoramento-do-desempenho-da-funcao-de-contratacoes', sectionNumber: '2.4', title: 'Monitoramento do desempenho da função de contratações' },
  { slug: '2-5-promocao-da-transparencia-e-da-accountability-das-contratacoes', sectionNumber: '2.5', title: 'Promoção da transparência e da accountability das contratações' },
  { slug: '2-6-atuacao-da-auditoria-interna-para-adicionar-valor-a-funcao-de-contratacoes-2', sectionNumber: '2.6', title: 'Atuação da auditoria interna para adicionar valor à função de contratações' },
  { slug: '3-metaprocesso-de-contratacao-publica', sectionNumber: '3', title: 'Metaprocesso de contratação pública' },
  { slug: '3-1-nocoes-gerais-sobre-licitacao', sectionNumber: '3.1', title: 'Noções gerais sobre licitação' },
  { slug: '3-1-1-o-que-e-licitacao', sectionNumber: '3.1.1', title: 'O que é licitação?' },
  { slug: '3-1-2-por-que-licitar-2', sectionNumber: '3.1.2', title: 'Por que licitar?' },
  { slug: '3-1-3-quem-deve-licitar', sectionNumber: '3.1.3', title: 'Quem deve licitar?' },
  { slug: '3-1-4-o-que-licitar', sectionNumber: '3.1.4', title: 'O que licitar?' },
  { slug: '3-1-5-como-licitar', sectionNumber: '3.1.5', title: 'Como licitar?' },
  { slug: '3-2-principios-das-licitacoes-e-dos-contratos-administrativos', sectionNumber: '3.2', title: 'Princípios das licitações e dos contratos administrativos' },
  { slug: '3-3-agentes-publicos', sectionNumber: '3.3', title: 'Agentes públicos' },
  { slug: '3-4-criterios-de-julgamento', sectionNumber: '3.4', title: 'Critérios de julgamento' },
  { slug: '3-4-1-menor-preco', sectionNumber: '3.4.1', title: 'Menor preço' },
  { slug: '3-4-2-maior-desconto', sectionNumber: '3.4.2', title: 'Maior desconto' },
  { slug: '3-4-3-melhor-tecnica-ou-conteudo-artistico', sectionNumber: '3.4.3', title: 'Melhor técnica ou conteúdo artístico' },
  { slug: '3-4-4-tecnica-e-preco-2', sectionNumber: '3.4.4', title: 'Técnica e preço' },
  { slug: '3-4-5-maior-lance-no-caso-de-leilao', sectionNumber: '3.4.5', title: 'Maior lance (no caso de leilão)' },
  { slug: '3-4-6-maior-retorno-economico', sectionNumber: '3.4.6', title: 'Maior retorno econômico' },
  { slug: '3-5-modos-de-disputa', sectionNumber: '3.5', title: 'Modos de disputa' },
  { slug: '3-6-modalidades-de-licitacao', sectionNumber: '3.6', title: 'Modalidades de licitação' },
  { slug: '3-6-1-pregao-2', sectionNumber: '3.6.1', title: 'Pregão' },
  { slug: '3-6-2-concorrencia', sectionNumber: '3.6.2', title: 'Concorrência' },
  { slug: '3-6-3-concurso', sectionNumber: '3.6.3', title: 'Concurso' },
  { slug: '3-6-4-leilao', sectionNumber: '3.6.4', title: 'Leilão' },
  { slug: '3-6-5-dialogo-competitivo-2', sectionNumber: '3.6.5', title: 'Diálogo Competitivo' },
  { slug: '4-planejamento-da-contratacao', sectionNumber: '4', title: 'Planejamento da contratação' },
  { slug: '4-1-estudo-tecnico-preliminar-etp', sectionNumber: '4.1', title: 'Estudo Técnico Preliminar (ETP)' },
  { slug: '4-1-1-descricao-da-necessidade-da-contratacao', sectionNumber: '4.1.1', title: 'Descrição da necessidade da contratação' },
  { slug: '4-1-2-demonstracao-da-previsao-da-contratacao-no-pca', sectionNumber: '4.1.2', title: 'Demonstração da previsão da contratação no PCA' },
  { slug: '4-1-3-requisitos-da-contratacao', sectionNumber: '4.1.3', title: 'Requisitos da contratação' },
  { slug: '4-1-4-estimativas-das-quantidades', sectionNumber: '4.1.4', title: 'Estimativas das quantidades' },
  { slug: '4-1-5-levantamento-de-mercado', sectionNumber: '4.1.5', title: 'Levantamento de mercado' },
  { slug: '4-1-6-estimativa-do-valor-da-contratacao-2', sectionNumber: '4.1.6', title: 'Estimativa do valor da contratação' },
  { slug: '4-1-7-descricao-da-solucao-como-um-todo', sectionNumber: '4.1.7', title: 'Descrição da solução como um todo' },
  { slug: '4-1-8-justificativas-para-o-parcelamento-ou-nao-da-contratacao', sectionNumber: '4.1.8', title: 'Justificativas para o parcelamento ou não da contratação' },
  { slug: '4-1-9-demonstrativo-dos-resultados-pretendidos', sectionNumber: '4.1.9', title: 'Demonstrativo dos resultados pretendidos' },
  { slug: '4-1-10-providencias-a-serem-adotadas-pela-administracao', sectionNumber: '4.1.10', title: 'Providências a serem adotadas pela Administração' },
  { slug: '4-1-11-contratacoes-correlatas-e-ou-interdependentes', sectionNumber: '4.1.11', title: 'Contratações correlatas e/ou interdependentes' },
  { slug: '4-1-12-descricao-de-possiveis-impactos-ambientais', sectionNumber: '4.1.12', title: 'Descrição de possíveis impactos ambientais' },
  { slug: '4-1-13-posicionamento-conclusivo-sobre-a-adequacao-da-contratacao', sectionNumber: '4.1.13', title: 'Posicionamento conclusivo sobre a adequação da contratação' },
  { slug: '4-2-analise-de-riscos', sectionNumber: '4.2', title: 'Análise de Riscos' },
  { slug: '4-3-termo-de-referencia-tr', sectionNumber: '4.3', title: 'Termo de referência (TR)' },
  { slug: '4-3-1-definicao-do-objeto', sectionNumber: '4.3.1', title: 'Definição do objeto' },
  { slug: '4-3-2-fundamentacao-da-contratacao', sectionNumber: '4.3.2', title: 'Fundamentação da Contratação' },
  { slug: '4-3-3-descricao-da-solucao-como-um-todo', sectionNumber: '4.3.3', title: 'Descrição da solução como um todo' },
  { slug: '4-3-4-requisitos-da-contratacao', sectionNumber: '4.3.4', title: 'Requisitos da contratação' },
  { slug: '4-3-5-modelo-de-execucao-do-objeto', sectionNumber: '4.3.5', title: 'Modelo de execução do objeto' },
  { slug: '4-3-6-modelo-de-gestao-do-contrato', sectionNumber: '4.3.6', title: 'Modelo de gestão do contrato' },
  { slug: '4-3-7-criterios-de-medicao-e-de-pagamento-2', sectionNumber: '4.3.7', title: 'Critérios de medição e de pagamento' },
  { slug: '4-3-8-formas-e-criterios-de-selecao-do-fornecedor', sectionNumber: '4.3.8', title: 'Formas e critérios de seleção do fornecedor' },
  { slug: '4-3-9-estimativa-do-valor-da-contratacao-2', sectionNumber: '4.3.9', title: 'Estimativa do valor da contratação' },
  { slug: '4-3-9-1-fontes-para-obtencao-de-precos-2', sectionNumber: '4.3.9.1', title: 'Pesquisa de preços' },
  { slug: '4-3-9-2-analise-critica-dos-precos-coletados', sectionNumber: '4.3.9.2', title: 'Análise crítica dos preços coletados' },
  { slug: '4-3-9-3-definicao-e-execucao-da-forma-de-calculo-do-valor-estimado-da-contratacao', sectionNumber: '4.3.9.3', title: 'Definição e execução da forma de cálculo do valor estimado da contratação' },
  { slug: '4-3-10-adequacao-orcamentaria-2', sectionNumber: '4.3.10', title: 'Adequação orçamentária' },
  { slug: '4-4-planejamento-para-contratacao-de-obras-e-servicos-de-engenharia-2', sectionNumber: '4.4', title: 'Planejamento para contratação de obras e serviços de engenharia' },
  { slug: '4-4-1-regimes-de-execucao-de-obras-e-servicos-de-engenharia-2', sectionNumber: '4.4.1', title: 'Regimes de execução de obras e serviços de engenharia' },
  { slug: '4-4-1-1-empreitada-por-preco-unitario-epu', sectionNumber: '4.4.1.1', title: 'Empreitada por preço unitário (EPU)' },
  { slug: '4-4-1-2-empreitada-por-preco-global-epg', sectionNumber: '4.4.1.2', title: 'Empreitada por preço global (EPG)' },
  { slug: '4-4-1-3-contratacao-integrada', sectionNumber: '4.4.1.3', title: 'Contratação Integrada' },
  { slug: '4-4-1-4-contratacao-semi-integrada', sectionNumber: '4.4.1.4', title: 'Contratação semi-integrada' },
  { slug: '4-4-2-anteprojeto', sectionNumber: '4.4.2', title: 'Anteprojeto' },
  { slug: '4-4-2-1-programa-de-necessidades-demanda-visao-global-e-niveis-de-servico', sectionNumber: '4.4.2.1', title: 'Programa de necessidades, demanda, visão global e níveis de serviço' },
  { slug: '4-4-2-2-condicoes-de-solidez-de-seguranca-e-de-durabilidade', sectionNumber: '4.4.2.2', title: 'Condições de solidez, de segurança e de durabilidade' },
  { slug: '4-4-2-3-prazo-de-entrega', sectionNumber: '4.4.2.3', title: 'Prazo de entrega' },
  { slug: '4-4-2-4-estetica-do-projeto-arquitetonico', sectionNumber: '4.4.2.4', title: 'Estética do projeto arquitetônico' },
  { slug: '4-4-2-5-outros-parametros', sectionNumber: '4.4.2.5', title: 'Outros parâmetros' },
  { slug: '4-4-2-6-proposta-de-concepcao-da-obra-ou-do-servico-de-engenharia', sectionNumber: '4.4.2.6', title: 'Proposta de concepção da obra ou do serviço de engenharia' },
  { slug: '4-4-2-7-projetos-anteriores-ou-estudos-preliminares', sectionNumber: '4.4.2.7', title: 'Projetos anteriores ou estudos preliminares' },
  { slug: '4-4-2-8-levantamento-topografico-e-cadastral', sectionNumber: '4.4.2.8', title: 'Levantamento topográfico e cadastral' },
  { slug: '4-4-2-9-pareceres-de-sondagem', sectionNumber: '4.4.2.9', title: 'Pareceres de sondagem' },
  { slug: '4-4-2-10-memorial-descritivo', sectionNumber: '4.4.2.10', title: 'Memorial descritivo' },
  { slug: '4-4-3-projeto-basico-pb', sectionNumber: '4.4.3', title: 'Projeto básico (PB)' },
  { slug: '4-4-3-1-levantamentos-sondagens-ensaios-e-estudos', sectionNumber: '4.4.3.1', title: 'Levantamentos, sondagens, ensaios e estudos' },
  { slug: '4-4-3-2-solucoes-tecnicas-globais-e-localizadas', sectionNumber: '4.4.3.2', title: 'Soluções técnicas globais e localizadas' },
  { slug: '4-4-3-3-identificacao-dos-servicos-dos-materiais-e-dos-equipamentos', sectionNumber: '4.4.3.3', title: 'Identificação dos serviços, dos materiais e dos equipamentos' },
  { slug: '4-4-3-4-informacoes-que-possibilitem-o-estudo-e-a-definicao-de-metodos-construtivos', sectionNumber: '4.4.3.4', title: 'Informações que possibilitem o estudo e a definição de métodos construtivos' },
  { slug: '4-4-3-5-subsidios-para-montagem-do-plano-de-licitacao-e-gestao-da-obra', sectionNumber: '4.4.3.5', title: 'Subsídios para montagem do plano de licitação e gestão da obra' },
  { slug: '4-4-3-6-orcamento-detalhado-do-custo-global-da-obra', sectionNumber: '4.4.3.6', title: 'Orçamento detalhado do custo global da obra' },
  { slug: '4-4-4-projeto-executivo', sectionNumber: '4.4.4', title: 'Projeto Executivo' },
  { slug: '4-5-edital', sectionNumber: '4.5', title: 'Edital' },
  { slug: '4-5-1-objeto-da-licitacao', sectionNumber: '4.5.1', title: 'Objeto da Licitação' },
  { slug: '4-5-2-regras-relativas-a-convocacao', sectionNumber: '4.5.2', title: 'Regras relativas à convocação' },
  { slug: '4-5-2-1-impedimentos-de-participar-da-licitacao', sectionNumber: '4.5.2.1', title: 'Impedimentos de participar da licitação' },
  { slug: '4-5-2-2-participacao-de-consorcios', sectionNumber: '4.5.2.2', title: 'Participação de consórcios' },
  { slug: '4-5-2-3-participacao-de-cooperativas', sectionNumber: '4.5.2.3', title: 'Participação de cooperativas' },
  { slug: '4-5-2-4-participacao-de-microempresas-e-de-empresas-de-pequeno-porte-2', sectionNumber: '4.5.2.4', title: 'Participação de microempresas e de empresas de pequeno porte' },
  { slug: '4-5-3-regras-da-licitacao', sectionNumber: '4.5.3', title: 'Regras da licitação' },
  { slug: '4-5-4-condicoes-contratuais', sectionNumber: '4.5.4', title: 'Condições Contratuais' },
  { slug: '4-5-5-matriz-de-riscos', sectionNumber: '4.5.5', title: 'Matriz de riscos' },
  { slug: '4-5-6-orcamento-sigiloso', sectionNumber: '4.5.6', title: 'Orçamento sigiloso' },
  { slug: '4-6-audiencia-publica-e-consulta-publica', sectionNumber: '4.6', title: 'Audiência pública e consulta pública' },
  { slug: '4-7-analise-juridica-da-contratacao', sectionNumber: '4.7', title: 'Análise jurídica da contratação' },
  { slug: '5-selecao-do-fornecedor', sectionNumber: '5', title: 'Seleção do fornecedor' },
  { slug: '5-1-divulgacao-do-edital', sectionNumber: '5.1', title: 'Divulgação do edital' },
  { slug: '5-1-1-impugnacao-e-pedidos-de-esclarecimento', sectionNumber: '5.1.1', title: 'Impugnação e pedidos de esclarecimento' },
  { slug: '5-2-apresentacao-de-propostas', sectionNumber: '5.2', title: 'Apresentação de propostas' },
  { slug: '5-2-1-garantia-de-proposta', sectionNumber: '5.2.1', title: 'Garantia de proposta' },
  { slug: '5-3-envio-de-lances', sectionNumber: '5.3', title: 'Envio de lances' },
  { slug: '5-4-julgamento', sectionNumber: '5.4', title: 'Julgamento' },
  { slug: '5-4-1-aceitabilidade-e-desclassificacao-2', sectionNumber: '5.4.1', title: 'Aceitabilidade e desclassificação' },
  { slug: '5-4-1-1-prova-de-qualidade', sectionNumber: '5.4.1.1', title: 'Prova de qualidade' },
  { slug: '5-4-1-2-amostra-e-prova-de-conceito', sectionNumber: '5.4.1.2', title: 'Amostra e prova de conceito' },
  { slug: '5-4-2-desempate-2', sectionNumber: '5.4.2', title: 'Desempate' },
  { slug: '5-4-2-3-por-decisao-arbitral-ou-judicial', sectionNumber: '6.4.2.3', title: 'Por decisão arbitral ou judicial' },
  { slug: '5-4-3-negociacao', sectionNumber: '5.4.3', title: 'Negociação' },
  { slug: '5-4-4-garantia-adicional-2', sectionNumber: '5.4.4', title: 'Garantia adicional' },
  { slug: '5-5-habilitacao-2', sectionNumber: '5.5', title: 'Habilitação' },
  { slug: '5-5-1-habilitacao-juridica', sectionNumber: '5.5.1', title: 'Habilitação Jurídica' },
  { slug: '5-5-2-habilitacao-tecnica', sectionNumber: '5.5.2', title: 'Habilitação Técnica' },
  { slug: '5-5-3-habilitacao-fiscal-social-e-trabalhista', sectionNumber: '5.5.3', title: 'Habilitação Fiscal, Social e Trabalhista' },
  { slug: '5-5-4-habilitacao-economico-financeira', sectionNumber: '5.5.4', title: 'Habilitação Econômico-Financeira' },
  { slug: '5-6-recurso-e-pedido-de-reconsideracao', sectionNumber: '5.6', title: 'Recurso e pedido de reconsideração' },
  { slug: '5-7-encerramento-da-licitacao', sectionNumber: '5.7', title: 'Encerramento da licitação' },
  { slug: '5-8-infracoes-e-sancoes-administrativas-licitantes', sectionNumber: '5.8', title: 'Infrações e sanções administrativas – licitantes' },
  { slug: '5-9-procedimentos-auxiliares', sectionNumber: '5.9', title: 'Procedimentos auxiliares' },
  { slug: '5-9-1-credenciamento-2', sectionNumber: '5.9.1', title: 'Credenciamento' },
  { slug: '5-9-2-pre-qualificacao', sectionNumber: '5.9.2', title: 'Pré-qualificação' },
  { slug: '5-9-3-procedimento-de-manifestacao-de-interesse-2', sectionNumber: '5.9.3', title: 'Procedimento de Manifestação de Interesse' },
  { slug: '5-9-4-sistema-de-registro-de-precos-2', sectionNumber: '5.9.4', title: 'Sistema de Registro de Preços' },
  { slug: '5-9-5-registro-cadastral', sectionNumber: '5.9.5', title: 'Registro Cadastral' },
  { slug: '5-10-processo-de-contratacao-direta', sectionNumber: '5.10', title: 'Processo de contratação direta' },
  { slug: '5-10-1-inexigibilidade-de-licitacao', sectionNumber: '5.10.1', title: 'Inexigibilidade de licitação' },
  { slug: '5-10-1-1-fornecedor-exclusivo-inciso-i', sectionNumber: '5.10.1.1', title: 'Fornecedor exclusivo (inciso I)' },
  { slug: '5-10-1-2-artista-consagrado-pela-critica-ou-pela-opiniao-publica-inciso-ii', sectionNumber: '5.10.1.2', title: 'Artista consagrado pela crítica ou pela opinião pública (inciso II)' },
  { slug: '5-10-1-3-servicos-tecnicos-especializados-de-natureza-predominantemente-intelectual-com-profissionais-ou-empresas-de-notoria-especializacao-inciso-iii', sectionNumber: '5.10.1.3', title: 'Serviços técnicos especializados de natureza predominantemente intelectual com profissionais ou empresas de notória especialização (inciso III)' },
  { slug: '5-10-1-4-credenciamento-inciso-iv', sectionNumber: '5.10.1.4', title: 'Credenciamento (inciso IV)' },
  { slug: '5-10-1-5-aquisicao-ou-locacao-de-imovel-singular-inciso-v', sectionNumber: '5.10.1.5', title: 'Aquisição ou locação de imóvel singular (inciso V)' },
  { slug: '5-10-2-dispensa-de-licitacao', sectionNumber: '5.10.2', title: 'Dispensa de licitação' },
  { slug: '5-10-2-1-dispensa-em-razao-do-valor-incisos-i-e-ii-2', sectionNumber: '5.10.2.1', title: 'Dispensa em razão do valor (incisos I e II)' },
  { slug: '5-10-2-2-licitacao-deserta-ou-fracassada-inciso-iii', sectionNumber: '5.10.2.2', title: 'Licitação deserta ou fracassada (inciso III)' },
  { slug: '5-10-2-3-vigencia-de-garantia-de-equipamentos-inciso-iv-alinea-a', sectionNumber: '5.10.2.3', title: 'Vigência de garantia de equipamentos (inciso IV, alínea “a”)' },
  { slug: '5-10-2-4-contratacoes-com-base-em-acordo-internacional-inciso-iv-alinea-b', sectionNumber: '5.10.2.4', title: 'Contratações com base em acordo internacional (inciso IV, alínea “b”)' },
  { slug: '5-10-2-5-pesquisa-e-desenvolvimento-inciso-iv-alinea-c', sectionNumber: '5.10.2.5', title: 'Pesquisa e desenvolvimento (inciso IV, alínea “c”)' },
  { slug: '5-10-2-6-contratacoes-realizadas-por-ict-ou-agencia-de-fomento-inciso-iv-alinea-d', sectionNumber: '5.10.2.6', title: 'Contratações realizadas por ICT ou agência de fomento (inciso IV, alínea “d”)' },
  { slug: '5-10-2-7-aquisicoes-de-generos-pereciveis-inciso-iv-alinea-e', sectionNumber: '5.10.2.7', title: 'Aquisições de gêneros perecíveis (inciso IV, alínea “e”)' },
  { slug: '5-10-2-8-alta-complexidade-tecnologica-e-defesa-nacional-inciso-iv-alinea-f', sectionNumber: '5.10.2.8', title: 'Alta complexidade tecnológica e defesa nacional (inciso IV, alínea “f”)' },
  { slug: '5-10-2-9-materiais-de-uso-das-forcas-armadas-inciso-iv-alinea-g', sectionNumber: '5.10.2.9', title: 'Materiais de uso das Forças Armadas (inciso IV, alínea “g”)' },
  { slug: '5-10-2-10-atendimento-de-contingentes-militares-no-exterior-inciso-iv-alinea-h', sectionNumber: '5.10.2.10', title: 'Atendimento de contingentes militares no exterior (inciso IV, alínea “h”)' },
  { slug: '5-10-2-11-abastecimento-ou-suprimento-de-efetivos-militares-inciso-iv-alinea-i', sectionNumber: '5.10.2.11', title: 'Abastecimento ou suprimento de efetivos militares (inciso IV, alínea “i”)' },
  { slug: '5-10-2-12-residuos-solidos-urbanos-inciso-iv-alinea-j', sectionNumber: '5.10.2.12', title: 'Resíduos sólidos urbanos (inciso IV, alínea “j”)' },
  { slug: '5-10-2-13-obras-de-arte-e-objetos-historicos-inciso-iv-alinea-k', sectionNumber: '5.10.2.13', title: 'Obras de arte e objetos históricos (inciso IV, alínea “k”)' },
  { slug: '5-10-2-14-equipamentos-para-rastreamento-e-obtencao-de-provas-inciso-iv-alinea-l', sectionNumber: '5.10.2.14', title: 'Equipamentos para rastreamento e obtenção de provas (inciso IV, alínea “l”)' },
  { slug: '5-10-2-15-medicamentos-para-tratamento-de-doencas-raras-inciso-iv-alinea-m', sectionNumber: '5.10.2.15', title: 'Medicamentos para tratamento de doenças raras (inciso IV, alínea “m”)' },
  { slug: '5-10-2-16-contratacoes-para-incentivo-a-inovacao-cientifica-inciso-v', sectionNumber: '5.10.2.16', title: 'Contratações para incentivo à inovação científica (inciso V)' },
  { slug: '5-10-2-17-comprometimento-da-seguranca-nacional-inciso-vi-2', sectionNumber: '5.10.2.17', title: 'Comprometimento da segurança nacional (inciso VI)' },
  { slug: '5-10-2-18-guerra-estado-de-defesa-estado-de-sitio-intervencao-federal-ou-grave-perturbacao-da-ordem-inciso-vii', sectionNumber: '5.10.2.18', title: 'Guerra, estado de defesa, estado de sítio, intervenção federal, ou grave perturbação da ordem (inciso VII)' },
  { slug: '5-10-2-19-emergencia-ou-calamidade-publica-inciso-viii', sectionNumber: '5.10.2.19', title: 'Emergência ou calamidade pública (inciso VIII)' },
  { slug: '5-10-2-20-bens-produzidos-ou-servicos-prestados-por-organizacao-do-poder-publico-inciso-ix', sectionNumber: '5.10.2.20', title: 'Bens produzidos ou serviços prestados por organização do poder público (inciso IX)' },
  { slug: '5-10-2-21-intervencao-no-dominio-economico-inciso-x', sectionNumber: '5.10.2.21', title: 'Intervenção no domínio econômico (inciso X)' },
  { slug: '5-10-2-22-celebracao-de-contrato-de-programa-inciso-xi', sectionNumber: '5.10.2.22', title: 'Celebração de contrato de programa (inciso XI)' },
  { slug: '5-10-2-23-transferencia-de-tecnologia-de-produtos-estrategicos-para-o-sus-inciso-xii-2', sectionNumber: '5.10.2.23', title: 'Transferência de tecnologia de produtos estratégicos para o SUS (inciso XII)' },
  { slug: '5-10-2-24-contratacoes-de-comissao-para-avaliacao-de-criterios-de-tecnica-inciso-xiii', sectionNumber: '5.10.2.24', title: 'Contratações de comissão para avaliação de critérios de técnica (inciso XIII)' },
  { slug: '5-10-2-25-contratacao-de-associacao-de-pessoas-com-deficiencia-inciso-xiv', sectionNumber: '5.10.2.25', title: 'Contratação de associação de pessoas com deficiência (inciso XIV)' },
  { slug: '5-10-2-26-contratacoes-de-instituicao-de-ensino-pesquisa-extensao-desenvolvimento-institucional-cientifico-e-tecnologico-ou-de-recuperacao-social-da-pessoa-presa-inciso-xv', sectionNumber: '5.10.2.26', title: 'Contratações de instituição de ensino, pesquisa, extensão, desenvolvimento institucional, científico e tecnológico ou de recuperação social da pessoa presa (inciso XV)' },
  { slug: '5-10-2-27-aquisicao-de-insumos-estrategicos-para-a-saude-inciso-xvi', sectionNumber: '5.10.2.27', title: 'Aquisição de insumos estratégicos para a saúde (inciso XVI)' },
  { slug: '5-11-formalizacao-do-contrato', sectionNumber: '5.11', title: 'Formalização do contrato' },
  { slug: '5-11-1-clausulas', sectionNumber: '5.11.1', title: 'Cláusulas' },
  { slug: '5-11-2-garantias-2', sectionNumber: '5.11.2', title: 'Garantias' },
  { slug: '5-11-3-alocacao-de-riscos', sectionNumber: '5.11.3', title: 'Alocação de riscos' },
  { slug: '5-11-4-prerrogativas-da-administracao', sectionNumber: '5.11.4', title: 'Prerrogativas da Administração' },
  { slug: '5-11-5-duracao', sectionNumber: '5.11.5', title: 'Duração' },
  { slug: '5-11-6-convocacao-para-contratar-2', sectionNumber: '5.11.6', title: 'Convocação para contratar' },
  { slug: '5-11-7-divulgacao', sectionNumber: '5.11.7', title: 'Divulgação' },
  { slug: '6-gestao-de-contrato', sectionNumber: '6', title: 'Gestão do contrato' },
  { slug: '6-1-execucao-do-contrato', sectionNumber: '6.1', title: 'Execução do contrato' },
  { slug: '6-1-1-subcontratacao', sectionNumber: '6.1.1', title: 'Subcontratação' },
  { slug: '6-1-2-providencias-previas-ao-inicio-da-execucao-do-contrato', sectionNumber: '6.1.2', title: 'Providências prévias ao início da execução do contrato' },
  { slug: '6-1-3-inicio-da-execucao-do-contrato', sectionNumber: '6.1.3', title: 'Início da execução do contrato' },
  { slug: '6-1-4-fiscalizacao-tecnica-e-recebimento-provisorio-2', sectionNumber: '6.1.4', title: 'Fiscalização técnica e recebimento provisório' },
  { slug: '6-1-5-fiscalizacao-administrativa-e-recebimento-provisorio-administrativo', sectionNumber: '6.1.5', title: 'Fiscalização administrativa e recebimento provisório administrativo' },
  { slug: '6-1-6-gestao-do-contrato-e-recebimento-definitivo-2', sectionNumber: '6.1.6', title: 'Gestão do contrato e recebimento definitivo' },
  { slug: '6-1-7-pagamento', sectionNumber: '6.1.7', title: 'Pagamento' },
  { slug: '6-1-8-infracoes-e-sancoes-administrativas-contratado', sectionNumber: '6.1.8', title: 'Infrações e sanções administrativas – contratado' },
  { slug: '6-1-9-meios-alternativos-de-resolucao-de-controversias', sectionNumber: '6.1.9', title: 'Meios alternativos de resolução de controvérsias' },
  { slug: '6-2-alteracao-do-contrato', sectionNumber: '6.2', title: 'Alteração do contrato' },
  { slug: '6-2-1-unilateral-2', sectionNumber: '6.2.1', title: 'Unilateral' },
  { slug: '6-2-2-consensual', sectionNumber: '6.2.2', title: 'Consensual' },
  { slug: '6-2-2-1-equilibrio-economico-financeiro', sectionNumber: '6.2.2.1', title: 'Equilíbrio econômico-financeiro' },
  { slug: '6-2-2-1-1-reequilibrio-economico-financeiro-recomposicao-ou-revisao-2', sectionNumber: '6.2.2.1.1', title: 'Reequilíbrio econômico-financeiro (recomposição ou revisão)' },
  { slug: '6-2-2-1-2-reajuste-em-sentido-estrito', sectionNumber: '6.2.2.1.2', title: 'Reajuste em sentido estrito' },
  { slug: '6-2-2-1-3-repactuacao', sectionNumber: '6.2.2.1.3', title: 'Repactuação' },
  { slug: '6-3-manutencao-e-prorrogacao-do-contrato', sectionNumber: '6.3', title: 'Manutenção e prorrogação do contrato' },
  { slug: '6-4-extincao-do-contrato', sectionNumber: '6.4', title: 'Extinção do contrato' },
  { slug: '6-4-1-extincao-normal-do-contrato', sectionNumber: '6.4.1', title: 'Extinção normal do contrato' },
  { slug: '6-4-2-formas-de-extincao-prematura-do-contrato', sectionNumber: '6.4.2', title: 'Formas de extinção prematura do contrato' },
  { slug: '6-4-2-1-por-ato-unilateral-da-administracao', sectionNumber: '6.4.2.1', title: 'Por ato unilateral da Administração' },
  { slug: '6-4-2-2-consensual', sectionNumber: '6.4.2.2', title: 'Consensual' },
  { slug: '6-4-3-causas-para-a-extincao-prematura-do-contrato', sectionNumber: '6.4.3', title: 'Causas para a extinção prematura do contrato' },
  { slug: '6-4-3-1-nulidade-do-contrato', sectionNumber: '6.4.3.1', title: 'Nulidade do contrato' },
  { slug: '6-4-3-2-inadimplemento-por-culpa-do-contratado', sectionNumber: '6.4.3.2', title: 'Inadimplemento por culpa do contratado' },
  { slug: '6-4-3-3-inadimplemento-por-culpa-da-administracao', sectionNumber: '6.4.3.3', title: 'Inadimplemento por culpa da Administração' },
  { slug: '6-4-3-4-outras-razoes', sectionNumber: '6.4.3.4', title: 'Outras razões' },
  { slug: '801-2', sectionNumber: '4.5.2.5', title: 'Margem de preferência' },
];

/**
 * Extracts article numbers from Lei 14.133/2021 mentioned in text.
 * Matches patterns like "Art. 6", "art. 156", "Arts. 155 e 156", "artigo 23".
 */
export function extractLeiArticles(text: string): number[] {
  const articles = new Set<number>();

  // Match "Art." / "Arts." / "art." / "artigo" followed by numbers
  const patterns = [
    /\b[Aa]rts?\.?\s*(\d{1,3})/g,
    /\b[Aa]rtigos?\s*(\d{1,3})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      // Lei 14.133 has articles 1-194
      if (num >= 1 && num <= 194) {
        articles.add(num);
      }
    }
  }

  // Also match patterns like "arts. 155 e 156" or "arts. 3º, 4º, 5º e 20"
  const multiPattern = /\b[Aa]rts?\.?\s*(\d{1,3})(?:[ºo]?)(?:\s*,\s*(\d{1,3})[ºo]?)*(?:\s+e\s+(\d{1,3})[ºo]?)?/g;
  let multiMatch;
  while ((multiMatch = multiPattern.exec(text)) !== null) {
    for (let i = 1; i < multiMatch.length; i++) {
      if (multiMatch[i]) {
        const num = parseInt(multiMatch[i], 10);
        if (num >= 1 && num <= 194) {
          articles.add(num);
        }
      }
    }
  }

  return Array.from(articles).sort((a, b) => a - b);
}

/**
 * Extracts the manual update date from the homepage HTML.
 * Looks for "Manual atualizado em DD/MM/AAAA".
 */
export function extractManualUpdateDate(html: string): string | null {
  const match = html.match(/Manual\s+atualizado\s+em\s+(\d{2}\/\d{2}\/\d{4})/i);
  return match ? match[1] : null;
}

/**
 * Scrapes a single page of the TCU manual.
 * Fetches the URL, parses HTML with cheerio, extracts structured content.
 */
export async function scrapeManualPage(
  section: ManualSection
): Promise<ScrapedPage | null> {
  const url = `${BASE_URL}/${section.slug}/`.replace(/\/\/$/, '/');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    apiLogger.error(`[TCU Manual] HTTP ${response.status} for ${url}`);
    return null;
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract title from header area
  const h1Text = $('div.main-title-header h1').first().text().trim();
  const title = h1Text || `${section.sectionNumber}. ${section.title}`;

  // Extract main content — the site uses div.main-content-general (not entry-content)
  const $content = $('div.main-content-general');
  if (!$content.length) {
    console.warn(`[TCU Manual] No main-content-general found at ${url}`);
    return null;
  }

  // Remove navigation, scripts, styles, sidebar, breadcrumb, and toggle buttons
  $content.find('script, style, nav, .sidebar, .menu, .breadcrumb, .toggleButton').remove();

  // Convert footnote references to inline text [N]
  $content.find('a[href^="#_ftn"]').each((_, el) => {
    const $a = $(el);
    $a.replaceWith(` [${$a.text()}]`);
  });

  // Extract text content by finding all block-level elements inside content
  // The content is nested inside div.main-content-general > div > (p, figure, ...)
  const contentParts: string[] = [];

  // Process all paragraphs, tables, blockquotes, and lists
  $content.find('p, table, figure.wp-block-table, blockquote, ul, ol').each((_, el) => {
    const $el = $(el);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tagName = (el as any).name?.toLowerCase();

    // Skip elements inside a figure (the table inside figure is processed via figure)
    if (tagName === 'table' && $el.parent('figure').length) return;

    if (tagName === 'table' || tagName === 'figure') {
      // Convert table to structured text
      const rows: string[] = [];
      $el.find('tr').each((_, row) => {
        const cells: string[] = [];
        $(row).find('th, td').each((_, cell) => {
          cells.push($(cell).text().trim());
        });
        if (cells.length > 0) {
          rows.push(cells.join(' | '));
        }
      });
      if (rows.length > 0) {
        contentParts.push(rows.join('\n'));
      }
    } else if (tagName === 'blockquote') {
      contentParts.push($el.text().trim());
    } else if (tagName === 'ul' || tagName === 'ol') {
      // Skip nested lists (only process top-level)
      if ($el.parents('ul, ol').length > 0) return;
      const items: string[] = [];
      $el.find('li').each((_, li) => {
        items.push('• ' + $(li).text().trim());
      });
      contentParts.push(items.join('\n'));
    } else {
      // paragraphs
      const text = $el.text().trim();
      if (text) {
        contentParts.push(text);
      }
    }
  });

  const content = contentParts
    .filter(p => p.length > 0)
    .join('\n\n')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!content || content.length < 50) {
    console.warn(`[TCU Manual] Content too short at ${url}: ${content.length} chars`);
    return null;
  }

  // Extract first meaningful paragraph as description (up to 300 chars)
  const firstParagraph = contentParts.find(p => p.length >= 30 && !p.startsWith('•'));
  const description = firstParagraph
    ? firstParagraph.slice(0, 300).replace(/\s+/g, ' ').trim()
    : content.slice(0, 300).replace(/\s+/g, ' ').trim();

  // Extract Lei 14.133 article references
  const leiArticles = extractLeiArticles(content);

  // Compute content hash for change detection
  const contentHash = computeHash(content);

  return {
    title,
    sectionNumber: section.sectionNumber,
    content,
    description,
    leiArticles,
    contentHash,
    url,
  };
}

/**
 * Fetches the manual homepage and extracts the update date.
 */
export async function fetchManualUpdateDate(): Promise<string | null> {
  try {
    const response = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) return null;
    const html = await response.text();
    return extractManualUpdateDate(html);
  } catch {
    return null;
  }
}
