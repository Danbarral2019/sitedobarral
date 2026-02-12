/**
 * Taxonomia fixa de temas de licitações baseados nos capítulos da Lei 14.133/2021
 * Cada tema mapeia a artigos da Lei para enriquecimento automático e filtro cruzado
 */

export const TEMAS_LICITACOES = [
  { value: 'principios-gerais',        label: 'Principios e Disposicoes Gerais',           articles: ['1','2','3','4','5'] },
  { value: 'agentes-governanca',       label: 'Agentes Publicos e Governanca',             articles: ['7','8','9','10','11','12','13'] },
  { value: 'planejamento',             label: 'Planejamento da Contratacao',               articles: ['18','19','20','21','22','23','24','25','26','27','28'] },
  { value: 'pesquisa-precos',          label: 'Pesquisa de Precos',                        articles: ['23'] },
  { value: 'modalidades',              label: 'Modalidades de Licitacao',                  articles: ['28','29','30','31','32','33'] },
  { value: 'pregao-eletronico',        label: 'Pregao Eletronico',                         articles: ['17','28','29'] },
  { value: 'contratacao-direta',       label: 'Dispensa e Inexigibilidade',                articles: ['72','73','74','75','76'] },
  { value: 'registro-precos',          label: 'Sistema de Registro de Precos',             articles: ['82','83','84','85','86'] },
  { value: 'contratos',                label: 'Contratos Administrativos',                 articles: ['89','90','91','92','93','94','95','96','97','98','99','100','101','102','103','104','105','106','107','108','109','110'] },
  { value: 'gestao-fiscalizacao',      label: 'Gestao e Fiscalizacao de Contratos',        articles: ['115','116','117','118','119','120','121'] },
  { value: 'sancoes',                  label: 'Sancoes Administrativas',                   articles: ['155','156','157','158','159','160','161','162'] },
  { value: 'sustentabilidade',         label: 'Sustentabilidade e Desenvolvimento',        articles: ['11','144','145','146'] },
  { value: 'tecnologia-informacao',    label: 'Contratacoes de TI',                        articles: ['6'] },
  { value: 'obras-engenharia',         label: 'Obras e Servicos de Engenharia',            articles: ['46','47','48','49'] },
  { value: 'controle-transparencia',   label: 'Controle e Transparencia',                  articles: ['169','170','171','172','173'] },
] as const;

export type TemaLicitacao = typeof TEMAS_LICITACOES[number]['value'];

/** Mapa rápido: artigo → temas */
export function getThemesForArticles(articles: string[]): TemaLicitacao[] {
  const themes = new Set<TemaLicitacao>();
  for (const art of articles) {
    for (const tema of TEMAS_LICITACOES) {
      if (tema.articles.includes(art)) {
        themes.add(tema.value);
      }
    }
  }
  return [...themes];
}

/** Mapa rápido: tema → label */
export function getThemeLabel(value: string): string {
  const tema = TEMAS_LICITACOES.find(t => t.value === value);
  return tema?.label || value;
}

/** Keywords para fallback de classificação por texto */
export const THEME_KEYWORDS: Record<TemaLicitacao, string[]> = {
  'principios-gerais': ['principio', 'disposicao', 'regra geral'],
  'agentes-governanca': ['agente', 'governanca', 'pregoeiro', 'comissao'],
  'planejamento': ['planejamento', 'estudo preliminar', 'ETP', 'termo de referencia', 'TR'],
  'pesquisa-precos': ['pesquisa de preco', 'preco estimado', 'orcamento'],
  'modalidades': ['modalidade', 'concorrencia', 'dialogo competitivo'],
  'pregao-eletronico': ['pregao', 'eletronico', 'lance'],
  'contratacao-direta': ['dispensa', 'inexigibilidade', 'contratacao direta'],
  'registro-precos': ['registro de preco', 'SRP', 'ata de registro'],
  'contratos': ['contrato administrativo', 'clausula', 'garantia contratual'],
  'gestao-fiscalizacao': ['fiscal', 'fiscalizacao', 'gestao contratual', 'medicao'],
  'sancoes': ['sancao', 'penalidade', 'multa', 'impedimento', 'declaracao de inidoneidade'],
  'sustentabilidade': ['sustentabilidade', 'desenvolvimento nacional', 'criterio ambiental'],
  'tecnologia-informacao': ['tecnologia da informacao', 'TIC', 'software', 'solucao de TI'],
  'obras-engenharia': ['obra', 'engenharia', 'servico de engenharia', 'BDI'],
  'controle-transparencia': ['controle', 'transparencia', 'portal', 'PNCP'],
};
