'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ContentTreeNode, ContentTreeResponse, TreeSelection, ContentType } from '@/lib/types/global-search';

interface UseContentTreeReturn {
  // State
  tree: ContentTreeNode[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;

  // Selection
  selection: TreeSelection | null;
  setSelection: (selection: TreeSelection | null) => void;
  selectNode: (node: ContentTreeNode) => void;
  clearSelection: () => void;

  // Expansion
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Actions
  refresh: () => Promise<void>;
}

export function useContentTree(): UseContentTreeReturn {
  // State
  const [tree, setTree] = useState<ContentTreeNode[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selection, setSelection] = useState<TreeSelection | null>(null);

  // Expansion state
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch tree data
  const fetchTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/area-restrita/content-tree');

      if (!response.ok) {
        throw new Error('Failed to fetch content tree');
      }

      const data: ContentTreeResponse = await response.json();
      setTree(data.tree);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Selection helpers
  const selectNode = useCallback((node: ContentTreeNode) => {
    setSelection({
      type: node.type,
      courseId: node.courseId,
      category: node.category,
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // Expansion helpers
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const expandNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => new Set(prev).add(nodeId));
  }, []);

  const collapseNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allNodeIds: string[] = [];

    const collectIds = (nodes: ContentTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allNodeIds.push(node.id);
          collectIds(node.children);
        }
      });
    };

    collectIds(tree);
    setExpandedNodes(new Set(allNodeIds));
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    await fetchTree();
  }, [fetchTree]);

  return {
    // State
    tree,
    totalCount,
    isLoading,
    error,

    // Selection
    selection,
    setSelection,
    selectNode,
    clearSelection,

    // Expansion
    expandedNodes,
    toggleNode,
    expandNode,
    collapseNode,
    expandAll,
    collapseAll,

    // Actions
    refresh,
  };
}
