import { useState, useEffect, useCallback } from 'react';
import { trackClientEvent } from '@/lib/monitoring/track-client';

interface Favorite {
  id: string;
  userId: string;
  documentId: string;
  courseId: string;
  createdAt: string;
}

export function useFavorites(courseId?: string) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const url = courseId
        ? `/api/favorites?courseId=${courseId}`
        : '/api/favorites';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorite = useCallback((documentId: string) => {
    return favorites.some(fav => fav.documentId === documentId);
  }, [favorites]);

  const [isToggling, setIsToggling] = useState(false);

  const toggleFavorite = useCallback(async (documentId: string, courseId: string) => {
    if (isToggling) return { success: false };
    setIsToggling(true);

    const isCurrentlyFavorite = isFavorite(documentId);
    // Optimistic update
    const previousFavorites = [...favorites];
    if (isCurrentlyFavorite) {
      setFavorites(prev => prev.filter(fav => fav.documentId !== documentId));
    }

    try {
      if (isCurrentlyFavorite) {
        const response = await fetch(`/api/favorites?documentId=${documentId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          setFavorites(previousFavorites); // Rollback
          return { success: false };
        }
        trackClientEvent('favorite_toggled', { action: 'remove' });
        return { success: true, action: 'removed' };
      } else {
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, courseId }),
        });
        if (response.ok) {
          const data = await response.json();
          setFavorites(prev => [...prev, data.favorite]);
          trackClientEvent('favorite_toggled', { action: 'add' });
          return { success: true, action: 'added' };
        }
        return { success: false };
      }
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
      setFavorites(previousFavorites); // Rollback on error
      return { success: false };
    } finally {
      setIsToggling(false);
    }
  }, [isFavorite, isToggling, favorites]);

  // Lista de IDs de documentos favoritos (útil para exportação PDF)
  const favoriteIds = favorites.map(fav => fav.documentId);

  return {
    favorites,
    favoriteIds,
    isLoading,
    isFavorite,
    toggleFavorite,
    refresh: loadFavorites,
  };
}
