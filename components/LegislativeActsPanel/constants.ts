export type LegislativeAct = {
  id: string;
  type: string;
  fullNumber?: string;
  title: string;
  ementa: string;
  summary?: string | null;
  issuer: string;
  publishDate: string;
  hierarchyLevel: number;
  leiArticles: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
  esfera?: string;
  themes?: string[];
  url?: string;
};

export type TabType = 'atos' | 'boas-praticas' | 'tic';

export const TYPE_LABELS: Record<string, string> = {
  decreto: 'Decreto',
  portaria: 'Portaria',
  in: 'Instrução Normativa',
  'ordem-servico': 'Ordem de Serviço',
  lei: 'Lei',
  'medida-provisoria': 'Medida Provisória',
  boa_pratica: 'Outro Ato Normativo',
};

export const TYPE_COLORS: Record<string, string> = {
  decreto: 'bg-blue-100 text-blue-800',
  portaria: 'bg-green-100 text-green-800',
  in: 'bg-purple-100 text-purple-800',
  'ordem-servico': 'bg-yellow-100 text-yellow-800',
  lei: 'bg-red-100 text-red-800',
  'medida-provisoria': 'bg-orange-100 text-orange-800',
  boa_pratica: 'bg-emerald-100 text-emerald-800',
};

export const ESFERA_LABELS: Record<string, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
};
