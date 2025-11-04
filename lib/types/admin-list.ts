/**
 * Generic Admin List Types (Fase 7 - Architectural Pattern)
 *
 * Tipos reutilizáveis para todas as páginas de listagem admin.
 * Suporta: filtros, paginação, ordenação, ações em lote.
 */

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Configuração de uma coluna da tabela
 */
export interface ColumnConfig<T> {
  /** ID único da coluna */
  id: string;
  /** Label exibido no header */
  label: string;
  /** Função para renderizar o valor da célula */
  render: (item: T) => ReactNode;
  /** Se a coluna é ordenável */
  sortable?: boolean;
  /** Largura da coluna (CSS class ou valor) */
  width?: string;
  /** Alinhamento do conteúdo */
  align?: 'left' | 'center' | 'right';
}

/**
 * Configuração de um filtro
 */
export interface FilterConfig {
  /** ID único do filtro (usado como query param key) */
  id: string;
  /** Label do filtro */
  label: string;
  /** Tipo de input */
  type: 'text' | 'select' | 'date' | 'daterange' | 'number';
  /** Placeholder (para inputs de texto) */
  placeholder?: string;
  /** Opções (para selects) */
  options?: { value: string; label: string }[];
  /** Valor padrão */
  defaultValue?: string;
  /** Largura (grid columns) */
  width?: number;
}

/**
 * Configuração de uma ação em lote
 */
export interface BatchAction<T> {
  /** ID único da ação */
  id: string;
  /** Label do botão */
  label: string;
  /** Ícone (Lucide) */
  icon: LucideIcon;
  /** Cor do botão */
  color: 'primary' | 'success' | 'danger' | 'warning';
  /** Função executada ao clicar */
  action: (selectedIds: string[], items: T[]) => Promise<void>;
  /** Se requer confirmação */
  requiresConfirmation?: boolean;
  /** Mensagem de confirmação */
  confirmationMessage?: string;
}

/**
 * Configuração de uma ação individual (por linha)
 */
export interface RowAction<T> {
  /** ID único da ação */
  id: string;
  /** Label (tooltip) */
  label: string;
  /** Ícone */
  icon: LucideIcon;
  /** Cor */
  color?: string;
  /** Função executada ao clicar */
  action: (item: T) => void | Promise<void>;
  /** Se deve mostrar a ação (condicional) */
  show?: (item: T) => boolean;
}

/**
 * Resultado paginado de uma query
 */
export interface PaginatedResult<T> {
  /** Items da página atual */
  items: T[];
  /** Total de items (sem paginação) */
  total: number;
  /** Página atual */
  page: number;
  /** Items por página */
  pageSize: number;
  /** Total de páginas */
  totalPages: number;
}

/**
 * Parâmetros de busca genéricos
 */
export interface ListSearchParams {
  /** Página atual */
  page?: string;
  /** Items por página */
  pageSize?: string;
  /** Campo de ordenação */
  sortBy?: string;
  /** Direção de ordenação */
  sortOrder?: 'asc' | 'desc';
  /** Termo de busca geral */
  search?: string;
  /** Filtros adicionais (key-value) */
  [key: string]: string | string[] | undefined;
}

/**
 * Configuração completa de uma lista admin
 */
export interface AdminListConfig<T> {
  /** Título da página */
  title: string;
  /** Descrição da página */
  description?: string;
  /** Configuração das colunas */
  columns: ColumnConfig<T>[];
  /** Configuração dos filtros */
  filters?: FilterConfig[];
  /** Ações em lote */
  batchActions?: BatchAction<T>[];
  /** Ações individuais */
  rowActions?: RowAction<T>[];
  /** Se permite seleção múltipla */
  allowSelection?: boolean;
  /** Página padrão */
  defaultPage?: number;
  /** PageSize padrão */
  defaultPageSize?: number;
  /** Opções de pageSize */
  pageSizeOptions?: number[];
  /** Se mostra busca global */
  showSearch?: boolean;
  /** Placeholder da busca global */
  searchPlaceholder?: string;
  /** Se mostra estatísticas no topo */
  showStats?: boolean;
  /** Função para calcular stats customizadas */
  getStats?: (items: T[]) => { label: string; value: number | string; icon: LucideIcon; color: string }[];
  /** Mensagem quando vazio */
  emptyMessage?: string;
  /** Ícone para estado vazio */
  emptyIcon?: LucideIcon;
}

/**
 * Props do ResourceListContainer (Server Component)
 */
export interface ResourceListContainerProps<T> {
  /** SearchParams da URL */
  searchParams: { [key: string]: string | string[] | undefined };
  /** Função para buscar dados (server-side) */
  fetchData: (params: ListSearchParams) => Promise<PaginatedResult<T>>;
  /** Configuração da lista */
  config: AdminListConfig<T>;
}

/**
 * Props do ResourceListClient (Client Component)
 */
export interface ResourceListClientProps<T> {
  /** Dados iniciais (do servidor) */
  initialData: PaginatedResult<T>;
  /** Configuração da lista */
  config: AdminListConfig<T>;
}

/**
 * Estado de uma lista (gerenciado no client)
 */
export interface ListState {
  /** IDs selecionados */
  selectedIds: Set<string>;
  /** Termo de busca local (filtro visual) */
  localSearch: string;
  /** Se está processando uma ação */
  isProcessing: boolean;
  /** Erro, se houver */
  error: string | null;
}
