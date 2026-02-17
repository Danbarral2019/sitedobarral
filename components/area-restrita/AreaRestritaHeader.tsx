'use client';

import Link from 'next/link';
import {
  LogOut,
  Heart,
  CheckCircle,
  Clock,
  Home,
  CreditCard,
} from 'lucide-react';

interface AreaRestritaHeaderProps {
  userName: string;
  enrolledCount: number;
  activePlan: string | null | undefined;
  onHomeClick: () => void;
  onLogout: () => void;
}

export function AreaRestritaHeader({
  userName,
  enrolledCount,
  activePlan,
  onHomeClick,
  onLogout,
}: AreaRestritaHeaderProps) {
  return (
    <header className="bg-white border-b-2 border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onHomeClick}
              className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
              title="Voltar ao Início"
            >
              <Home className="w-5 h-5 lg:w-6 lg:h-6" />
            </button>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm lg:text-lg">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm lg:text-lg font-bold text-gray-900">
                Bem-vindo, {userName.split(' ')[0]}
              </h2>
              <p className="text-xs lg:text-sm text-gray-600">
                {enrolledCount} {enrolledCount === 1 ? 'curso' : 'cursos'}
              </p>
            </div>
            <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600 sm:hidden" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Badge de plano + link de assinatura */}
            {activePlan ? (
              <button
                onClick={async () => {
                  const res = await fetch('/api/stripe/portal', { method: 'POST' });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
                title="Gerenciar assinatura"
              >
                <CreditCard className="w-4 h-4" />
                <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                  {activePlan === 'premium' ? 'Premium' : 'Básico'}
                </span>
              </button>
            ) : (
              <Link
                href="/planos"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
              >
                <CreditCard className="w-4 h-4" />
                <span>Planos</span>
              </Link>
            )}
            <Link
              href="/area-restrita/favoritos"
              className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden lg:inline">Favoritos</span>
            </Link>
            <Link
              href="/area-restrita/historico"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Clock className="w-4 h-4" />
              <span>Histórico</span>
            </Link>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
