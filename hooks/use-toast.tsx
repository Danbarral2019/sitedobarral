'use client';

import * as React from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProviderWrapper({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup all timers on unmount
  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const addToast = React.useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration (default 5s)
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, toast.duration || 5000);
    timersRef.current.set(id, timer);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Hook de toasts.
 *
 * **Contrato de estabilidade:** `toast`, `success`, `error`, `info`,
 * `warning` e `removeToast` retornam *referências estáveis* (memoizadas
 * via useCallback no provider e neste hook). Por isso, podem ser
 * incluídas com segurança nas deps de `useCallback`/`useEffect` sem
 * causar loop de re-render.
 *
 * O array `toasts` E o objeto-raiz retornado MUDAM quando há novo
 * toast — não use `useToast()` inteiro como dep, desestruture a função
 * específica que precisa.
 */
export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProviderWrapper');
  }

  const { addToast } = context;

  const success = React.useCallback(
    (title: string, description?: string) => addToast({ title, description, variant: 'success' }),
    [addToast],
  );
  const error = React.useCallback(
    (title: string, description?: string) => addToast({ title, description, variant: 'error' }),
    [addToast],
  );
  const info = React.useCallback(
    (title: string, description?: string) => addToast({ title, description, variant: 'info' }),
    [addToast],
  );
  const warning = React.useCallback(
    (title: string, description?: string) => addToast({ title, description, variant: 'warning' }),
    [addToast],
  );

  return {
    toast: addToast,
    success,
    error,
    info,
    warning,
    ...context,
  };
}
