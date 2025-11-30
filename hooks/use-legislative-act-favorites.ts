import { useState, useEffect, useCallback } from 'react';

interface LegislativeActFavorite {
  id: string;
  legislativeActId: string;
  createdAt: string;
}

export function useLegislativeActFavorites() {
  const [favorites, setFavorites] = useState<LegislativeActFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const response = await fetch('/api/favorites/legislative-acts');
      if (response.ok) {
        const data = await response.json();
        // Mapear para estrutura simples
        setFavorites(
          (data.favorites || []).map((act: { id: string; favoritedAt?: string }) => ({
            id: act.id,
            legislativeActId: act.id,
            createdAt: act.favoritedAt || new Date().toISOString(),
          }))
        );
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos de atos:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorite = useCallback(
    (actId: string) => {
      return favorites.some((fav) => fav.legislativeActId === actId);
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (actId: string) => {
      const wasAlreadyFavorite = isFavorite(actId);

      // Otimistic update
      if (wasAlreadyFavorite) {
        setFavorites((prev) => prev.filter((fav) => fav.legislativeActId !== actId));
      } else {
        setFavorites((prev) => [
          ...prev,
          {
            id: actId,
            legislativeActId: actId,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      try {
        const response = await fetch(`/api/legislative-acts/${actId}/favorite`, {
          method: 'POST',
        });

        if (!response.ok) {
          // Reverter se falhar
          if (wasAlreadyFavorite) {
            setFavorites((prev) => [
              ...prev,
              {
                id: actId,
                legislativeActId: actId,
                createdAt: new Date().toISOString(),
              },
            ]);
          } else {
            setFavorites((prev) => prev.filter((fav) => fav.legislativeActId !== actId));
          }
          return { success: false };
        }

        const data = await response.json();
        return { success: true, action: data.action };
      } catch (error) {
        console.error('Erro ao alternar favorito de ato:', error);
        // Reverter em caso de erro
        if (wasAlreadyFavorite) {
          setFavorites((prev) => [
            ...prev,
            {
              id: actId,
              legislativeActId: actId,
              createdAt: new Date().toISOString(),
            },
          ]);
        } else {
          setFavorites((prev) => prev.filter((fav) => fav.legislativeActId !== actId));
        }
        return { success: false };
      }
    },
    [isFavorite]
  );

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    refresh: loadFavorites,
  };
}
