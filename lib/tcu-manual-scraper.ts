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
  // Cap. 1 — Introdução
  { slug: '1-1-objetivo-e-escopo', sectionNumber: '1.1', title: 'Objetivo e escopo' },
  { slug: '1-2-organizacao-do-conteudo', sectionNumber: '1.2', title: 'Organização do conteúdo' },

  // Cap. 2 — Governança das contratações públicas
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
  { slug: '2-3-2-2-plano-de-logistica-sustentavel-pls', sectionNumber: '2.3.2.2', title: 'Plano de Logística Sustentável (PLS)' },
  { slug: '2-3-2-3-plano-de-contratacoes-anual-pca', sectionNumber: '2.3.2.3', title: 'Plano de Contratações Anual (PCA)' },
  { slug: '2-4-monitoramento-do-desempenho-da-funcao-de-contratacoes', sectionNumber: '2.4', title: 'Monitoramento do desempenho da função de contratações' },
  { slug: '2-5-promocao-da-transparencia-e-da-accountability-das-contratacoes', sectionNumber: '2.5', title: 'Promoção da transparência e da accountability das contratações' },
  { slug: '2-6-atuacao-da-auditoria-interna-para-adicionar-valor-a-funcao-de-contratacoes-2', sectionNumber: '2.6', title: 'Atuação da auditoria interna para adicionar valor à função de contratações' },

  // Cap. 3 — Metaprocesso de contratação pública
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
  { slug: '3-4-5-maior-lance-no-caso-de-leilao', sectionNumber: '3.4.5', title: 'Maior lance, no caso de leilão' },
  { slug: '3-4-6-maior-retorno-economico', sectionNumber: '3.4.6', title: 'Maior retorno econômico' },
  { slug: '3-5-modos-de-disputa', sectionNumber: '3.5', title: 'Modos de disputa' },
  { slug: '3-6-modalidades-de-licitacao', sectionNumber: '3.6', title: 'Modalidades de licitação' },
  { slug: '3-6-1-pregao-2', sectionNumber: '3.6.1', title: 'Pregão' },
  { slug: '3-6-2-concorrencia', sectionNumber: '3.6.2', title: 'Concorrência' },
  { slug: '3-6-3-concurso', sectionNumber: '3.6.3', title: 'Concurso' },
  { slug: '3-6-4-leilao', sectionNumber: '3.6.4', title: 'Leilão' },
  { slug: '3-6-5-dialogo-competitivo-2', sectionNumber: '3.6.5', title: 'Diálogo competitivo' },

  // Cap. 4 — Planejamento da contratação
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
  { slug: '4-1-10-providencias-a-serem-adotadas-pela-administracao', sectionNumber: '4.1.10', title: 'Providências a serem adotadas pela administração' },
  { slug: '4-1-11-contratacoes-correlatas-e-ou-interdependentes', sectionNumber: '4.1.11', title: 'Contratações correlatas e/ou interdependentes' },
  { slug: '4-1-12-descricao-de-possiveis-impactos-ambientais', sectionNumber: '4.1.12', title: 'Descrição de possíveis impactos ambientais' },
  { slug: '4-1-13-posicionamento-conclusivo-sobre-a-adequacao-da-contratacao', sectionNumber: '4.1.13', title: 'Posicionamento conclusivo sobre a adequação da contratação' },
  { slug: '4-2-analise-de-riscos', sectionNumber: '4.2', title: 'Análise de riscos' },
  { slug: '4-3-termo-de-referencia-tr', sectionNumber: '4.3', title: 'Termo de Referência (TR)' },
  { slug: '4-3-1-definicao-do-objeto', sectionNumber: '4.3.1', title: 'Definição do objeto' },
  { slug: '4-3-2-fundamentacao-da-contratacao', sectionNumber: '4.3.2', title: 'Fundamentação da contratação' },
  { slug: '4-3-3-descricao-da-solucao-como-um-todo', sectionNumber: '4.3.3', title: 'Descrição da solução como um todo' },
  { slug: '4-3-4-requisitos-da-contratacao', sectionNumber: '4.3.4', title: 'Requisitos da contratação' },
  { slug: '4-3-5-modelo-de-execucao-do-objeto', sectionNumber: '4.3.5', title: 'Modelo de execução do objeto' },
  { slug: '4-3-6-modelo-de-gestao-do-contrato', sectionNumber: '4.3.6', title: 'Modelo de gestão do contrato' },
  { slug: '4-3-7-criterios-de-medicao-e-de-pagamento-2', sectionNumber: '4.3.7', title: 'Critérios de medição e de pagamento' },
  { slug: '4-3-8-formas-e-criterios-de-selecao-do-fornecedor', sectionNumber: '4.3.8', title: 'Formas e critérios de seleção do fornecedor' },
  { slug: '4-3-9-estimativa-do-valor-da-contratacao-2', sectionNumber: '4.3.9', title: 'Estimativa do valor da contratação' },
  { slug: '4-3-9-1-fontes-para-obtencao-de-precos-2', sectionNumber: '4.3.9.1', title: 'Fontes para obtenção de preços' },
  { slug: '4-3-9-2-analise-critica-dos-precos-coletados', sectionNumber: '4.3.9.2', title: 'Análise crítica dos preços coletados' },
  { slug: '4-3-9-3-definicao-e-execucao-da-forma-de-calculo-do-valor-estimado-da-contratacao', sectionNumber: '4.3.9.3', title: 'Definição e execução da forma de cálculo do valor estimado da contratação' },
  { slug: '4-3-10-adequacao-orcamentaria-2', sectionNumber: '4.3.10', title: 'Adequação orçamentária' },
  { slug: '4-4-planejamento-para-contratacao-de-obras-e-servicos-de-engenharia-2', sectionNumber: '4.4', title: 'Planejamento para contratação de obras e serviços de engenharia' },
  { slug: '4-4-1-regimes-de-execucao-de-obras-e-servicos-de-engenharia-2', sectionNumber: '4.4.1', title: 'Regimes de execução de obras e serviços de engenharia' },
  { slug: '4-4-1-1-empreitada-por-preco-unitario-epu', sectionNumber: '4.4.1.1', title: 'Empreitada por Preço Unitário (EPU)' },
  { slug: '4-4-1-2-empreitada-por-preco-global-epg', sectionNumber: '4.4.1.2', title: 'Empreitada por Preço Global (EPG)' },
  { slug: '4-4-1-3-contratacao-integrada', sectionNumber: '4.4.1.3', title: 'Contratação Integrada' },
  { slug: '4-4-1-4-contratacao-semi-integrada', sectionNumber: '4.4.1.4', title: 'Contratação Semi-integrada' },
  { slug: '4-4-2-anteprojeto', sectionNumber: '4.4.2', title: 'Anteprojeto' },
  { slug: '4-4-2-1-programa-de-necessidades', sectionNumber: '4.4.2.1', title: 'Programa de necessidades' },
  { slug: '4-4-2-2-estudo-de-viabilidade', sectionNumber: '4.4.2.2', title: 'Estudo de viabilidade' },
  { slug: '4-4-2-3-condicionantes-ambientais-2', sectionNumber: '4.4.2.3', title: 'Condicionantes ambientais' },
  { slug: '4-4-2-4-condicionantes-legais', sectionNumber: '4.4.2.4', title: 'Condicionantes legais' },
  { slug: '4-4-2-5-alternativas-tecnicas-e-escolha-das-solucoes', sectionNumber: '4.4.2.5', title: 'Alternativas técnicas e escolha das soluções' },
  { slug: '4-4-2-6-concepao-do-projeto-de-engenharia', sectionNumber: '4.4.2.6', title: 'Concepção do projeto de engenharia' },
  { slug: '4-4-2-7-estudos-e-levantamentos-topograficos', sectionNumber: '4.4.2.7', title: 'Estudos e levantamentos topográficos' },
  { slug: '4-4-2-8-estimativa-preliminar-de-custos', sectionNumber: '4.4.2.8', title: 'Estimativa preliminar de custos' },
  { slug: '4-4-2-10-memorial-descritivo', sectionNumber: '4.4.2.10', title: 'Memorial descritivo' },
  { slug: '4-4-3-projeto-basico-pb', sectionNumber: '4.4.3', title: 'Projeto Básico (PB)' },
  { slug: '4-4-3-1-levantamentos-e-estudos-complementares', sectionNumber: '4.4.3.1', title: 'Levantamentos e estudos complementares' },
  { slug: '4-4-3-2-solucoes-tecnicas-globais-e-localizadas', sectionNumber: '4.4.3.2', title: 'Soluções técnicas globais e localizadas' },
  { slug: '4-4-3-3-identificacao-dos-tipos-de-servicos-a-executar-e-de-materiais-e-equipamentos-a-incorporar-a-obra', sectionNumber: '4.4.3.3', title: 'Identificação dos tipos de serviços a executar e de materiais e equipamentos a incorporar à obra' },
  { slug: '4-4-3-4-informacoes-que-possibilitem-o-estudo-e-a-deducao-de-metodos-construtivos-instalacoes-provisorias-e-condicoes-organizacionais-para-a-obra', sectionNumber: '4.4.3.4', title: 'Informações que possibilitem o estudo e a dedução de métodos construtivos' },
  { slug: '4-4-3-5-subsidios-para-montagem-do-plano-de-licitacao-e-gestao-da-obra', sectionNumber: '4.4.3.5', title: 'Subsídios para montagem do plano de licitação e gestão da obra' },
  { slug: '4-4-3-6-orcamento-detalhado', sectionNumber: '4.4.3.6', title: 'Orçamento detalhado' },
  { slug: '4-4-4-projeto-executivo', sectionNumber: '4.4.4', title: 'Projeto executivo' },
  { slug: '4-5-edital', sectionNumber: '4.5', title: 'Edital' },
  { slug: '4-5-1-objeto-da-licitacao', sectionNumber: '4.5.1', title: 'Objeto da licitação' },
  { slug: '4-5-2-regras-relativas-a-convocacao', sectionNumber: '4.5.2', title: 'Regras relativas à convocação' },
  { slug: '4-5-2-1-participacao-de-empresas-em-consorcio', sectionNumber: '4.5.2.1', title: 'Participação de empresas em consórcio' },
  { slug: '4-5-2-2-participacao-de-empresas-estrangeiras', sectionNumber: '4.5.2.2', title: 'Participação de empresas estrangeiras' },
  { slug: '4-5-2-3-participacao-de-cooperativas', sectionNumber: '4.5.2.3', title: 'Participação de cooperativas' },
  { slug: '4-5-2-4-impedimentos-de-participacao', sectionNumber: '4.5.2.4', title: 'Impedimentos de participação' },
  { slug: '801-2', sectionNumber: '4.5.2.5', title: 'Margem de preferência' },
  { slug: '4-5-3-regras-da-licitacao', sectionNumber: '4.5.3', title: 'Regras da licitação' },
  { slug: '4-5-4-condicoes-contratuais', sectionNumber: '4.5.4', title: 'Condições contratuais' },
  { slug: '4-5-5-matriz-de-riscos', sectionNumber: '4.5.5', title: 'Matriz de riscos' },
  { slug: '4-5-6-orcamento-sigiloso', sectionNumber: '4.5.6', title: 'Orçamento sigiloso' },
  { slug: '4-6-audiencia-publica-e-consulta-publica', sectionNumber: '4.6', title: 'Audiência pública e consulta pública' },
  { slug: '4-7-analise-juridica-da-contratacao', sectionNumber: '4.7', title: 'Análise jurídica da contratação' },

  // Cap. 5 — Seleção do fornecedor
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
  { slug: '5-4-3-negociacao', sectionNumber: '5.4.3', title: 'Negociação' },
  { slug: '5-4-4-garantia-adicional-2', sectionNumber: '5.4.4', title: 'Garantia adicional' },
  { slug: '5-5-habilitacao-2', sectionNumber: '5.5', title: 'Habilitação' },
  { slug: '5-5-1-habilitacao-juridica', sectionNumber: '5.5.1', title: 'Habilitação jurídica' },
  { slug: '5-5-2-habilitacao-tecnica', sectionNumber: '5.5.2', title: 'Habilitação técnica' },
  { slug: '5-5-3-habilitacao-fiscal-social-e-trabalhista', sectionNumber: '5.5.3', title: 'Habilitação fiscal, social e trabalhista' },
  { slug: '5-5-4-habilitacao-economico-financeira', sectionNumber: '5.5.4', title: 'Habilitação econômico-financeira' },
  { slug: '5-6-recurso-e-pedido-de-reconsideracao', sectionNumber: '5.6', title: 'Recurso e pedido de reconsideração' },
  { slug: '5-7-encerramento-da-licitacao', sectionNumber: '5.7', title: 'Encerramento da licitação' },
  { slug: '5-8-infracoes-e-sancoes-administrativas-licitantes', sectionNumber: '5.8', title: 'Infrações e sanções administrativas — licitantes' },
  { slug: '5-9-procedimentos-auxiliares', sectionNumber: '5.9', title: 'Procedimentos auxiliares' },
  { slug: '5-9-1-credenciamento-2', sectionNumber: '5.9.1', title: 'Credenciamento' },
  { slug: '5-9-2-pre-qualificacao', sectionNumber: '5.9.2', title: 'Pré-qualificação' },
  { slug: '5-9-3-procedimento-de-manifestacao-de-interesse-2', sectionNumber: '5.9.3', title: 'Procedimento de Manifestação de Interesse' },
  { slug: '5-9-4-sistema-de-registro-de-precos-2', sectionNumber: '5.9.4', title: 'Sistema de Registro de Preços' },
  { slug: '5-9-5-registro-cadastral', sectionNumber: '5.9.5', title: 'Registro cadastral' },
  { slug: '5-10-processo-de-contratacao-direta', sectionNumber: '5.10', title: 'Processo de contratação direta' },
  { slug: '5-10-1-inexigibilidade-de-licitacao', sectionNumber: '5.10.1', title: 'Inexigibilidade de licitação' },
  { slug: '5-10-1-1-fornecedor-exclusivo', sectionNumber: '5.10.1.1', title: 'Fornecedor exclusivo' },
  { slug: '5-10-1-2-servicos-tecnicos-especializados-de-natureza-predominantemente-intelectual', sectionNumber: '5.10.1.2', title: 'Serviços técnicos especializados de natureza predominantemente intelectual' },
  { slug: '5-10-1-3-profissional-ou-empresa-de-notoria-especializacao', sectionNumber: '5.10.1.3', title: 'Profissional ou empresa de notória especialização' },
  { slug: '5-10-1-4-credenciamento-2', sectionNumber: '5.10.1.4', title: 'Credenciamento' },
  { slug: '5-10-1-5-locacao-de-imovel-com-caracteristicas-singulares', sectionNumber: '5.10.1.5', title: 'Locação de imóvel com características singulares' },
  { slug: '5-10-2-dispensa-de-licitacao', sectionNumber: '5.10.2', title: 'Dispensa de licitação' },
  { slug: '5-10-2-1-dispensa-em-razao-do-valor', sectionNumber: '5.10.2.1', title: 'Dispensa em razão do valor' },
  { slug: '5-10-2-2-dispensa-para-contratacao-de-remanescente', sectionNumber: '5.10.2.2', title: 'Dispensa para contratação de remanescente' },
  { slug: '5-10-2-3-dispensa-por-emergencia-ou-calamidade-publica', sectionNumber: '5.10.2.3', title: 'Dispensa por emergência ou calamidade pública' },
  { slug: '5-10-2-4-dispensa-por-licitacao-deserta-ou-fracassada', sectionNumber: '5.10.2.4', title: 'Dispensa por licitação deserta ou fracassada' },
  { slug: '5-10-2-5-dispensa-para-aquisicao-de-hortifrutigranjeiros', sectionNumber: '5.10.2.5', title: 'Dispensa para aquisição de hortifrutigranjeiros' },
  { slug: '5-10-2-6-dispensa-para-contratacao-de-instituicao-sem-fins-lucrativos', sectionNumber: '5.10.2.6', title: 'Dispensa para contratação de instituição sem fins lucrativos' },
  { slug: '5-10-2-7-dispensa-para-coleta-processamento-e-comercializacao-de-residuos-solidos-urbanos-reciclaveis', sectionNumber: '5.10.2.7', title: 'Dispensa para coleta, processamento e comercialização de resíduos sólidos urbanos recicláveis' },
  { slug: '5-10-2-8-dispensa-para-contratacao-de-instituicao-ou-organizacao-brasileira', sectionNumber: '5.10.2.8', title: 'Dispensa para contratação de instituição ou organização brasileira' },
  { slug: '5-10-2-9-dispensa-para-fornecimento-de-energia-eletrica-e-gas-natural', sectionNumber: '5.10.2.9', title: 'Dispensa para fornecimento de energia elétrica e gás natural' },
  { slug: '5-10-2-10-dispensa-para-contratacao-entre-entes-federativos-e-suas-entidades', sectionNumber: '5.10.2.10', title: 'Dispensa para contratação entre entes federativos e suas entidades' },
  { slug: '5-10-2-11-dispensa-para-aquisicao-por-pessoa-juridica-de-direito-publico-interno-de-bens-produzidos-ou-servicos-prestados-por-orgao-ou-entidade-que-integrem-a-administracao-publica', sectionNumber: '5.10.2.11', title: 'Dispensa para aquisição por pessoa jurídica de direito público interno' },
  { slug: '5-10-2-12-dispensa-para-contratacao-de-concessionario-permissionario-ou-autorizado-para-o-fornecimento-ou-suprimento-de-energia-eletrica-ou-gas-canalizado', sectionNumber: '5.10.2.12', title: 'Dispensa para contratação de concessionário, permissionário ou autorizado' },
  { slug: '5-10-2-13-dispensa-para-contratacoes-visando-ao-cumprimento-do-disposto-nos-arts-3o-4o-5o-e-20-da-lei-no-8-666-93', sectionNumber: '5.10.2.13', title: 'Dispensa para contratações visando ao cumprimento do disposto nos arts. 3º, 4º, 5º e 20 da Lei 10.973' },
  { slug: '5-10-2-14-dispensa-para-aquisicao-de-materiais-de-defesa-com-base-na-retaliacao-comercial', sectionNumber: '5.10.2.14', title: 'Dispensa para aquisição de materiais de defesa' },
  { slug: '5-10-2-15-dispensa-para-contratacao-de-abastecimento-de-navios-embarcacoes-unidades-aereas-ou-tropas-e-seus-meios-de-transporte', sectionNumber: '5.10.2.15', title: 'Dispensa para contratação de abastecimento de navios, embarcações e unidades aéreas' },
  { slug: '5-10-2-16-dispensa-para-aquisicao-de-bens-e-contratacao-de-servicos-para-atividades-de-inteligencia-e-contrainteligencia', sectionNumber: '5.10.2.16', title: 'Dispensa para atividades de inteligência e contrainteligência' },
  { slug: '5-10-2-17-dispensa-para-contratacoes-que-envolvam-transferencia-de-tecnologia-de-produtos-estrategicos-para-o-sistema-unico-de-saude', sectionNumber: '5.10.2.17', title: 'Dispensa para transferência de tecnologia de produtos estratégicos para o SUS' },
  { slug: '5-10-2-18-dispensa-para-compra-ou-locacao-de-imovel-destinado-ao-atendimento-de-finalidades-precípuas-da-administracao', sectionNumber: '5.10.2.18', title: 'Dispensa para compra ou locação de imóvel' },
  { slug: '5-10-2-19-dispensa-para-contratacao-de-entidade-de-previdencia-complementar', sectionNumber: '5.10.2.19', title: 'Dispensa para contratação de entidade de previdência complementar' },
  { slug: '5-10-2-20-dispensa-por-razoes-de-seguranca-nacional', sectionNumber: '5.10.2.20', title: 'Dispensa por razões de segurança nacional' },
  { slug: '5-10-2-21-dispensa-para-contratacao-de-associacao-de-pessoas-com-deficiencia', sectionNumber: '5.10.2.21', title: 'Dispensa para contratação de associação de pessoas com deficiência' },
  { slug: '5-10-2-22-dispensa-para-contratacao-visando-ao-cumprimento-de-acordo-internacional', sectionNumber: '5.10.2.22', title: 'Dispensa para contratação visando ao cumprimento de acordo internacional' },
  { slug: '5-10-2-23-dispensa-para-contratacao-de-assistencia-tecnica-e-extensao-rural', sectionNumber: '5.10.2.23', title: 'Dispensa para contratação de assistência técnica e extensão rural' },
  { slug: '5-10-2-24-dispensa-para-aquisicao-de-bens-e-insumos-destinados-a-pesquisa-cientifica-e-tecnologica', sectionNumber: '5.10.2.24', title: 'Dispensa para aquisição de bens e insumos destinados a pesquisa científica e tecnológica' },
  { slug: '5-10-2-25-dispensa-para-aquisicao-de-medicamentos-destinados-exclusivamente-ao-tratamento-de-doencas-raras-definidas-pelo-ministerio-da-saude', sectionNumber: '5.10.2.25', title: 'Dispensa para aquisição de medicamentos destinados a doenças raras' },
  { slug: '5-10-2-26-dispensa-para-contratacao-de-seguro-para-cobertura-de-riscos-de-engenharia', sectionNumber: '5.10.2.26', title: 'Dispensa para contratação de seguro de engenharia' },
  { slug: '5-10-2-27-dispensa-para-aquisicao-de-insumos-estrategicos-para-a-saude', sectionNumber: '5.10.2.27', title: 'Dispensa para aquisição de insumos estratégicos para a saúde' },
  { slug: '5-11-formalizacao-do-contrato', sectionNumber: '5.11', title: 'Formalização do contrato' },
  { slug: '5-11-1-clausulas', sectionNumber: '5.11.1', title: 'Cláusulas' },
  { slug: '5-11-2-garantias-2', sectionNumber: '5.11.2', title: 'Garantias' },
  { slug: '5-11-3-alocacao-de-riscos', sectionNumber: '5.11.3', title: 'Alocação de riscos' },
  { slug: '5-11-4-prerrogativas-da-administracao', sectionNumber: '5.11.4', title: 'Prerrogativas da administração' },
  { slug: '5-11-5-duracao', sectionNumber: '5.11.5', title: 'Duração' },
  { slug: '5-11-6-convocacao-para-contratar-2', sectionNumber: '5.11.6', title: 'Convocação para contratar' },
  { slug: '5-11-7-divulgacao', sectionNumber: '5.11.7', title: 'Divulgação' },

  // Cap. 6 — Gestão do contrato
  { slug: '6-gestao-de-contrato', sectionNumber: '6', title: 'Gestão de contrato' },
  { slug: '6-1-execucao-do-contrato', sectionNumber: '6.1', title: 'Execução do contrato' },
  { slug: '6-1-1-subcontratacao', sectionNumber: '6.1.1', title: 'Subcontratação' },
  { slug: '6-1-2-providencias-previas-ao-inicio-da-execucao-do-contrato', sectionNumber: '6.1.2', title: 'Providências prévias ao início da execução do contrato' },
  { slug: '6-1-3-inicio-da-execucao-do-contrato', sectionNumber: '6.1.3', title: 'Início da execução do contrato' },
  { slug: '6-1-4-fiscalizacao-tecnica-e-recebimento-provisorio-2', sectionNumber: '6.1.4', title: 'Fiscalização técnica e recebimento provisório' },
  { slug: '6-1-5-fiscalizacao-administrativa-e-recebimento-provisorio-administrativo', sectionNumber: '6.1.5', title: 'Fiscalização administrativa e recebimento provisório administrativo' },
  { slug: '6-1-6-gestao-do-contrato-e-recebimento-definitivo-2', sectionNumber: '6.1.6', title: 'Gestão do contrato e recebimento definitivo' },
  { slug: '6-1-7-pagamento', sectionNumber: '6.1.7', title: 'Pagamento' },
  { slug: '6-1-8-infracoes-e-sancoes-administrativas-contratado', sectionNumber: '6.1.8', title: 'Infrações e sanções administrativas — contratado' },
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
  { slug: '6-4-2-1-por-ato-unilateral-da-administracao', sectionNumber: '6.4.2.1', title: 'Por ato unilateral da administração' },
  { slug: '6-4-2-2-consensual', sectionNumber: '6.4.2.2', title: 'Consensual' },
  // Note: section 6.4.2.3 has a slug typo on the TCU site (starts with 5- instead of 6-)
  { slug: '5-4-2-3-por-decisao-arbitral-ou-judicial', sectionNumber: '6.4.2.3', title: 'Por decisão arbitral ou judicial' },
  { slug: '6-4-3-causas-para-a-extincao-prematura-do-contrato', sectionNumber: '6.4.3', title: 'Causas para a extinção prematura do contrato' },
  { slug: '6-4-3-1-nulidade-do-contrato', sectionNumber: '6.4.3.1', title: 'Nulidade do contrato' },
  { slug: '6-4-3-2-inadimplemento-por-culpa-do-contratado', sectionNumber: '6.4.3.2', title: 'Inadimplemento por culpa do contratado' },
  { slug: '6-4-3-3-inadimplemento-por-culpa-da-administracao', sectionNumber: '6.4.3.3', title: 'Inadimplemento por culpa da administração' },
  { slug: '6-4-3-4-outras-razoes', sectionNumber: '6.4.3.4', title: 'Outras razões' },
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
