'use client';

import { useCallback, useEffect, useState } from 'react';

export interface BadgeItem {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  courseId: string | null;
  type: string;
  label: string;
  icon: string;
  metadata: unknown;
  awardedAt: string;
}

export interface BadgeCatalogEntry {
  type: string;
  label: string;
  icon: string;
  description: string;
  award: 'auto' | 'manual';
  count: number;
}

export interface BadgeStats {
  total: number;
  catalog: BadgeCatalogEntry[];
}

interface UseBadgesAdmin {
  items: BadgeItem[];
  stats: BadgeStats | null;
  isLoadingList: boolean;
  isLoadingStats: boolean;
  isSaving: boolean;
  error: string | null;
  filterType: string;
  setFilterType: (t: string) => void;
  reload: () => Promise<void>;
  award: (input: { userEmail: string; type: string; courseId?: string }) => Promise<boolean>;
  revoke: (id: string) => Promise<boolean>;
}

export function useBadgesAdmin(): UseBadgesAdmin {
  const [items, setItems] = useState<BadgeItem[]>([]);
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const qs = new URLSearchParams();
      if (filterType) qs.set('type', filterType);
      qs.set('limit', '100');
      const res = await fetch(`/api/admin/badges?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } finally {
      setIsLoadingList(false);
    }
  }, [filterType]);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/admin/badges/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const reload = useCallback(async () => {
    await Promise.all([loadList(), loadStats()]);
  }, [loadList, loadStats]);

  const award = useCallback<UseBadgesAdmin['award']>(
    async (input) => {
      setError(null);
      setIsSaving(true);
      try {
        const res = await fetch('/api/admin/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error?.message || data.message || 'Erro ao premiar badge');
          return false;
        }
        await reload();
        return true;
      } finally {
        setIsSaving(false);
      }
    },
    [reload],
  );

  const revoke = useCallback(
    async (id: string) => {
      setError(null);
      const res = await fetch(`/api/admin/badges/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message || data.message || 'Erro ao revogar badge');
        return false;
      }
      await reload();
      return true;
    },
    [reload],
  );

  return {
    items,
    stats,
    isLoadingList,
    isLoadingStats,
    isSaving,
    error,
    filterType,
    setFilterType,
    reload,
    award,
    revoke,
  };
}
