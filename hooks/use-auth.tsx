'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAccessStatus, checkSubscriptionAccess, getActivePlan, type AccessStatus, type SubscriptionInfo } from '@/lib/enrollment-utils';

interface Enrollment {
  id: string;
  courseId: string;
  turma: string | null;
  qrCodeId: string | null;
  enrolledAt: string;
  expiresAt: string | null;
  isLifetime: boolean;
  lifetimeUpgradedAt: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
  enrollments?: Enrollment[];
  subscriptions?: SubscriptionInfo[];
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  login: (email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
  isEnrolledIn: (courseId: string) => boolean;
  getEnrollmentStatus: (courseId: string) => AccessStatus | null;
  hasActiveAccess: (courseId: string) => boolean;
  activePlan: 'premium' | 'basico' | null;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Tentar verificar autenticação (cookie será enviado automaticamente)
      const response = await fetch('/api/auth/me');

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer login');
    }

    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isEnrolledIn = (courseId: string): boolean => {
    if (!user || !user.enrollments) return false;
    return user.enrollments.some(enrollment => enrollment.courseId === courseId);
  };

  const getEnrollmentStatus = (courseId: string): AccessStatus | null => {
    if (!user || !user.enrollments) return null;

    const enrollment = user.enrollments.find(e => e.courseId === courseId);
    if (!enrollment) return null;

    return checkAccessStatus({
      id: enrollment.id,
      courseId: enrollment.courseId,
      expiresAt: enrollment.expiresAt,
      isLifetime: enrollment.isLifetime,
      turma: enrollment.turma,
      qrCodeId: enrollment.qrCodeId,
    });
  };

  const hasActiveAccess = (courseId: string): boolean => {
    // Verificar enrollment (QR Code / presencial)
    const status = getEnrollmentStatus(courseId);
    if (status?.hasAccess) return true;

    // Verificar subscription (Mercado Pago)
    return checkSubscriptionAccess(user?.subscriptions, courseId);
  };

  const activePlan = getActivePlan(user?.subscriptions);

  return {
    user,
    isLoading,
    logout,
    login,
    isAuthenticated: !!user,
    isEnrolledIn,
    getEnrollmentStatus,
    hasActiveAccess,
    activePlan,
  };
}
