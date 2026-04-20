'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface SidebarCtx {
  /** Sidebar visível em desktop (lg+). Persiste em localStorage. */
  desktopOpen: boolean;
  toggleDesktop: () => void;
  setDesktopOpen: (v: boolean) => void;
  /** Drawer mobile aberto (<lg). Volátil por sessão. */
  mobileOpen: boolean;
  toggleMobile: () => void;
  setMobileOpen: (v: boolean) => void;
  /** Marca se já hidratou do localStorage (evita flash SSR). */
  hydrated: boolean;
}

const Ctx = createContext<SidebarCtx | null>(null);

const STORAGE_KEY = 'areaRestrita:sidebarOpen';

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Default: aberto em desktop; fechamos manualmente via localStorage
  const [desktopOpen, setDesktopOpenState] = useState<boolean>(true);
  const [mobileOpen, setMobileOpenState] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidratação do localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        setDesktopOpenState(raw === 'true');
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setDesktopOpen = useCallback((v: boolean) => {
    setDesktopOpenState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleDesktop = useCallback(() => {
    setDesktopOpenState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleMobile = useCallback(() => setMobileOpenState((v) => !v), []);
  const setMobileOpen = useCallback((v: boolean) => setMobileOpenState(v), []);

  return (
    <Ctx.Provider
      value={{
        desktopOpen,
        toggleDesktop,
        setDesktopOpen,
        mobileOpen,
        toggleMobile,
        setMobileOpen,
        hydrated,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSidebar deve ser usado dentro de SidebarProvider');
  return ctx;
}
