/**
 * Custom Hook: useAdminList
 *
 * Gerencia estado e ações de listas admin (Client-side)
 * Parte do padrão arquitetural da Fase 7.
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { buildSearchParams } from '@/lib/url-state';
import { useToast } from './use-toast';

interface UseAdminListOptions {
  /** Callback após sucesso de ação em lote */
  onBatchActionSuccess?: (message: string) => void;
  /** Callback após erro de ação em lote */
  onBatchActionError?: (error: string) => void;
}

export function useAdminList<T extends { id: string }>(options: UseAdminListOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Estado local
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  /**
   * Atualizar filtro na URL
   */
  const updateFilter = useCallback(
    (key: string, value: string | number | null) => {
      const query = buildSearchParams(searchParams, { [key]: value, page: null }); // Reset page on filter change
      router.replace(`${pathname}?${query}`);
    },
    [router, pathname, searchParams]
  );

  /**
   * Atualizar múltiplos filtros de uma vez
   */
  const updateFilters = useCallback(
    (updates: Record<string, string | number | null>) => {
      const query = buildSearchParams(searchParams, { ...updates, page: null });
      router.replace(`${pathname}?${query}`);
    },
    [router, pathname, searchParams]
  );

  /**
   * Ir para página específica
   */
  const goToPage = useCallback(
    (page: number) => {
      const query = buildSearchParams(searchParams, { page });
      router.replace(`${pathname}?${query}`);
    },
    [router, pathname, searchParams]
  );

  /**
   * Alterar page size
   */
  const changePageSize = useCallback(
    (pageSize: number) => {
      const query = buildSearchParams(searchParams, { pageSize, page: null }); // Reset to page 1
      router.replace(`${pathname}?${query}`);
    },
    [router, pathname, searchParams]
  );

  /**
   * Alternar seleção de um item
   */
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Selecionar todos os items visíveis
   */
  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  /**
   * Limpar seleção
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Executar ação em lote
   */
  const executeBatchAction = useCallback(
    async (
      actionFn: (ids: string[], items: T[]) => Promise<{ success: boolean; message: string; count?: number }>,
      items: T[]
    ) => {
      if (selectedIds.size === 0) {
        toast({
          title: 'Erro',
          description: 'Selecione ao menos um item',
          variant: 'error',
        });
        return;
      }

      setIsProcessing(true);
      try {
        const selectedItems = items.filter((item) => selectedIds.has(item.id));
        const result = await actionFn(Array.from(selectedIds), selectedItems);

        if (result.success) {
          toast({
            title: 'Sucesso!',
            description: result.message,
            variant: 'success',
          });

          // Recarregar dados
          router.refresh();
          clearSelection();

          if (options.onBatchActionSuccess) {
            options.onBatchActionSuccess(result.message);
          }
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        toast({
          title: 'Erro',
          description: errorMessage,
          variant: 'error',
        });

        if (options.onBatchActionError) {
          options.onBatchActionError(errorMessage);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedIds, toast, router, clearSelection, options]
  );

  /**
   * Executar ação individual
   */
  const executeRowAction = useCallback(
    async (
      actionFn: (item: T) => Promise<void> | void,
      item: T,
      options?: {
        successMessage?: string;
        errorMessage?: string;
        refreshOnSuccess?: boolean;
      }
    ) => {
      setIsProcessing(true);
      try {
        await actionFn(item);

        if (options?.successMessage) {
          toast({
            title: 'Sucesso!',
            description: options.successMessage,
            variant: 'success',
          });
        }

        if (options?.refreshOnSuccess !== false) {
          router.refresh();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : options?.errorMessage || 'Erro desconhecido';
        toast({
          title: 'Erro',
          description: errorMessage,
          variant: 'error',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast, router]
  );

  /**
   * Filtrar items localmente (busca visual client-side)
   */
  const filterItemsLocally = useCallback(
    (items: T[], searchKeys: (keyof T)[]) => {
      if (!localSearch) return items;

      const term = localSearch.toLowerCase();
      return items.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(term);
          }
          return false;
        })
      );
    },
    [localSearch]
  );

  /**
   * Refresh (recarregar dados do servidor)
   */
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return {
    // Estado
    selectedIds,
    isProcessing,
    localSearch,
    setLocalSearch,

    // Filtros e paginação (URL state)
    updateFilter,
    updateFilters,
    goToPage,
    changePageSize,

    // Seleção
    toggleSelection,
    selectAll,
    clearSelection,

    // Ações
    executeBatchAction,
    executeRowAction,

    // Busca local
    filterItemsLocally,

    // Refresh
    refresh,

    // Utils
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
  };
}
