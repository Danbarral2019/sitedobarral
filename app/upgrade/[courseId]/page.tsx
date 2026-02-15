'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default function UpgradePage({ params }: PageProps) {
  const { courseId } = use(params);
  const router = useRouter();
  const { user, isLoading, getEnrollmentStatus, activePlan } = useAuth();

  const [enrollmentStatus, setEnrollmentStatus] = useState<ReturnType<typeof getEnrollmentStatus>>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push(`/login?returnTo=/upgrade/${courseId}`);
      return;
    }

    if (user) {
      const status = getEnrollmentStatus(courseId);
      setEnrollmentStatus(status);

      // Se já tem acesso vitalício ou subscription ativa, redireciona
      if (status?.isLifetime || activePlan) {
        router.push('/area-restrita');
      }
    }
  }, [user, isLoading, courseId, router, getEnrollmentStatus, activePlan]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const daysRemaining = enrollmentStatus?.daysRemaining || 0;
  const expiresAt = enrollmentStatus?.expiresAt ? new Date(enrollmentStatus.expiresAt).toLocaleDateString('pt-BR') : '';
  const isExpired = enrollmentStatus?.isExpired;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-100">
          {/* Status do trial */}
          {enrollmentStatus && !enrollmentStatus.isLifetime && (
            <div className={`mb-8 p-4 rounded-lg ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              {isExpired ? (
                <p className="text-red-800">
                  Seu período de acesso gratuito <strong>expirou</strong>.
                </p>
              ) : (
                <p className="text-yellow-800">
                  Seu acesso gratuito expira em <strong>{expiresAt}</strong>
                  {daysRemaining > 0 && ` (${daysRemaining} dias restantes)`}
                </p>
              )}
            </div>
          )}

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Continue Aprendendo
          </h1>
          <p className="text-gray-600 mb-8">
            Assine um plano para manter acesso aos materiais e continuar seus estudos.
          </p>

          <div className="space-y-3">
            <Link
              href={`/planos?curso=${courseId}`}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              Ver Planos de Assinatura
            </Link>
            <Link
              href="/area-restrita"
              className="block w-full text-gray-600 hover:text-gray-900 font-medium py-2 transition-colors"
            >
              Voltar para Área Restrita
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
