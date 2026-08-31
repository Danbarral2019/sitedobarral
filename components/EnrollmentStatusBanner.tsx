'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

interface EnrollmentStatusBannerProps {
  courseId: string;
}

export default function EnrollmentStatusBanner({ courseId }: EnrollmentStatusBannerProps) {
  const { user, getEnrollmentStatus } = useAuth();

  if (!user) {
    return null;
  }

  const status = getEnrollmentStatus(courseId);

  if (!status) {
    return null; // Usuário não matriculado neste curso
  }

  // Usuário tem acesso vitalício
  if (status.isLifetime) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-[6px] p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-green-900">
                ⭐ Acesso Vitalício Ativo
              </h3>
              <p className="mt-1 text-sm text-green-800">
                Você tem acesso ilimitado a todos os materiais deste curso. Seu acesso nunca expira!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Acesso expirado
  if (status.isExpired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-[6px] p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-semibold text-red-900">
              Acesso Expirado
            </h3>
            <p className="mt-1 text-sm text-red-800">
              Seu período de acesso ao curso expirou. Para continuar acessando os materiais, entre em contato com o professor.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Link
                href={`/upgrade/${courseId}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Renovar Acesso
              </Link>
              <Link
                href="/contato"
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Falar com Professor
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Acesso expirando em breve (menos de 90 dias)
  if (status.isExpiringSoon) {
    const daysRemaining = status.daysRemaining || 0;
    const expiryDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : '';

    return (
      <div className="bg-amber-accent-soft border border-amber-accent-soft rounded-[6px] p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-amber-accent-deep"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-semibold text-amber-accent-deep">
              ⚠️ Seu acesso está expirando
            </h3>
            <p className="mt-1 text-sm text-amber-accent-deep">
              {daysRemaining > 0 ? (
                <>
                  Faltam <strong>{daysRemaining} dias</strong> para seu acesso expirar ({expiryDate}).
                  Faça o upgrade para acesso vitalício e nunca perca o acesso aos materiais!
                </>
              ) : (
                <>
                  Seu acesso expira em <strong>{expiryDate}</strong>.
                  Garanta acesso vitalício aos materiais do curso!
                </>
              )}
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Link
                href={`/upgrade/${courseId}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-accent hover:bg-amber-accent-deep focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-accent"
              >
                ⭐ Upgrade para Vitalício
              </Link>
              <span className="inline-flex items-center px-4 py-2 text-sm text-amber-accent-deep">
                Consulte as condições especiais
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Acesso ativo normal (mais de 90 dias restantes)
  const daysRemaining = status.daysRemaining || 0;
  const expiryDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : '';

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-[6px] p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-brand-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-semibold text-brand-900">
              ✓ Acesso Ativo
            </h3>
            <p className="mt-1 text-sm text-brand-800">
              Seu acesso é válido até <strong>{expiryDate}</strong> ({daysRemaining} dias restantes)
            </p>
            <p className="mt-2 text-xs text-brand-700">
              💡 Dica: Faça o upgrade para acesso vitalício e nunca se preocupe com renovação!
            </p>
          </div>
        </div>
        <div className="ml-3 flex-shrink-0">
          <Link
            href={`/upgrade/${courseId}`}
            className="inline-flex items-center px-3 py-1.5 border border-brand-300 text-xs font-medium rounded-md text-brand-700 bg-white hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
          >
            Ver Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
