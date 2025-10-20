'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  courseId?: string;
  turma?: string;
}

/**
 * Hook reutilizável para verificar autenticação de admin
 *
 * Uso:
 *
 * export default function AdminPage() {
 *   const { user, isLoading } = useAdminAuth();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   // Aqui você sabe que user existe e é admin
 *   return <div>Olá, {user.name}</div>;
 * }
 */
export function useAdminAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyAdminAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');

      if (!response.ok) {
        // Não está autenticado
        router.push('/validar-acesso');
        return;
      }

      const data = await response.json();

      if (data.user.role !== 'admin') {
        // Autenticado mas não é admin
        router.push('/area-restrita');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    verifyAdminAccess();
  }, [verifyAdminAccess]);

  return {
    user,
    isLoading,
    refresh: verifyAdminAccess,
  };
}

/**
 * Hook reutilizável para verificar autenticação geral (admin ou student)
 *
 * Uso:
 *
 * export default function RestrictedPage() {
 *   const { user, isLoading } = useAuth();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return <div>Olá, {user.name}</div>;
 * }
 */
export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');

      if (!response.ok) {
        // Não está autenticado
        router.push('/validar-acesso');
        return;
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      router.push('/validar-acesso');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    verifyAccess();
  }, [verifyAccess]);

  return {
    user,
    isLoading,
    refresh: verifyAccess,
  };
}
