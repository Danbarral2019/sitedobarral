import { useState, useEffect, useCallback } from 'react';

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

  const toggleFavorite = useCallback(async (documentId: string, courseId: string) => {
    const isCurrentlyFavorite = isFavorite(documentId);

    try {
      if (isCurrentlyFavorite) {
        // Remover favorito
        const response = await fetch(`/api/favorites?documentId=${documentId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setFavorites(prev => prev.filter(fav => fav.documentId !== documentId));
          return { success: true, action: 'removed' };
        }
      } else {
        // Adicionar favorito
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, courseId }),
        });

        if (response.ok) {
          const data = await response.json();
          setFavorites(prev => [...prev, data.favorite]);
          return { success: true, action: 'added' };
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
      return { success: false };
    }
  }, [isFavorite]);

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
