// Types for Global Search functionality in Area Restrita

// Content type categories with their respective colors and icons
export type ContentType = 'document' | 'course-material' | 'lei' | 'glossary' | 'faq' | 'video' | 'blog' | 'site' | 'legislative-act';

export const CONTENT_TYPE_CONFIG: Record<ContentType, {
  label: string;
  labelPlural: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}> = {
  document: {
    label: 'Documento',
    labelPlural: 'Base de Conhecimento',
    color: 'text-brand-600',
    bgColor: 'bg-brand-50',
    borderColor: 'border-brand-200',
    icon: 'FileText',
  },
  'course-material': {
    label: 'Material do Curso',
    labelPlural: 'Materiais do Curso',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: 'BookOpen',
  },
  lei: {
    label: 'Lei 14.133',
    labelPlural: 'Lei 14.133',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    icon: 'Scale',
  },
  glossary: {
    label: 'Glossário',
    labelPlural: 'Glossário',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'BookOpen',
  },
  video: {
    label: 'Vídeo',
    labelPlural: 'Vídeos',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'Video',
  },
  site: {
    label: 'Site',
    labelPlural: 'Sites',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    icon: 'Globe',
  },
  faq: {
    label: 'FAQ',
    labelPlural: 'Perguntas Frequentes',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    icon: 'HelpCircle',
  },
  blog: {
    label: 'Blog',
    labelPlural: 'Blog',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'Newspaper',
  },
  'legislative-act': {
    label: 'Ato Normativo',
    labelPlural: 'Atos Normativos',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: 'Gavel',
  },
};

// Individual result types
export interface DocumentResult {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  type: string;
  url?: string | null;
  courseId?: string | null;
  courseName?: string;
  tags?: string | null;
  uploadedAt: string;
  isPublic: boolean;
}

export interface LeiArticleResult {
  numero: string;
  titulo?: string | null;
  ementa: string;
  capitulo: string;
  secao?: string | null;
  excerpts?: string[]; // Relevant excerpts for search highlighting
}

export interface GlossaryResult {
  id: string;
  term: string;
  slug: string;
  definition: string;
  shortDef?: string | null;
  category?: string | null;
}

export interface VideoResult {
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl?: string | null;
  courseId: string;
  courseName?: string;
}

export interface SiteResult {
  id: string;
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
  category?: string | null;
}

export interface LegislativeActResult {
  id: string;
  type: string;
  fullNumber: string;
  title: string;
  ementa: string;
  summary?: string | null;
  issuer: string;
  publishDate: string;
  hierarchyLevel: number;
  leiArticles: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
}

export interface FAQResult {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface BlogPostResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  tags?: string | null;
}

// Unified search result item
export interface SearchResultItem {
  type: ContentType;
  data: DocumentResult | LeiArticleResult | GlossaryResult | VideoResult | SiteResult | LegislativeActResult | FAQResult | BlogPostResult;
}

// Global search response
export interface GlobalSearchResponse {
  query: string;
  results: SearchResultItem[];
  counts: {
    document: number;
    lei: number;
    glossary: number;
    faq: number;
    video: number;
    blog: number;
    site: number;
    'legislative-act': number;
    total: number;
  };
  hasMore: boolean;
}

// Content tree node
export interface ContentTreeNode {
  id: string;
  type: ContentType;
  label: string;
  count: number;
  children?: ContentTreeNode[];
  courseId?: string;
  category?: string;
}

// Content tree response
export interface ContentTreeResponse {
  tree: ContentTreeNode[];
  totalCount: number;
}

// Search filters
export interface GlobalSearchFilters {
  types: ContentType[];
  courseIds: string[];
  categories: string[];
  dateRange?: 'all' | '7days' | '30days' | '90days';
}

// Active tree selection
export interface TreeSelection {
  type?: ContentType;
  courseId?: string;
  category?: string;
}
