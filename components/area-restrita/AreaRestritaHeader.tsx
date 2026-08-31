'use client';

import Link from 'next/link';
import {
  LogOut,
  Heart,
  CheckCircle,
  Clock,
  Home,
  CreditCard,
  Award,
} from 'lucide-react';
import { SidebarMobileTrigger } from './AreaRestritaSidebar';

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
    <header className="bg-white/95 border-b border-border-subtle sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <SidebarMobileTrigger variant="header" />
            <button
              onClick={onHomeClick}
              className="p-2 rounded-[6px] text-brand-600 hover:bg-brand-50 transition-colors"
              title="Voltar ao Início"
            >
              <Home className="w-5 h-5 lg:w-6 lg:h-6" />
            </button>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-brand-600 rounded-full flex items-center justify-center border border-border-subtle">
              <span className="text-white font-bold text-sm lg:text-lg">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm lg:text-lg font-bold text-ink-primary">
                Bem-vindo, {userName.split(' ')[0]}
              </h2>
              <p className="text-xs lg:text-sm text-ink-muted">
                {enrolledCount} {enrolledCount === 1 ? 'curso' : 'cursos'}
              </p>
            </div>
            <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600 sm:hidden" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Badge de plano + link de assinatura */}
            {activePlan ? (
              <a
                href="/api/conta/portal"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-brand-50 rounded-[6px] transition-colors font-medium text-sm"
                title="Gerenciar assinatura"
              >
                <CreditCard className="w-4 h-4" />
                <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-brand-100 text-brand-700">
                  {activePlan === 'premium' ? 'Premium' : 'Básico'}
                </span>
              </a>
            ) : (
              <Link
                href="/planos"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-brand-50 rounded-[6px] transition-colors font-medium text-sm"
              >
                <CreditCard className="w-4 h-4" />
                <span>Planos</span>
              </Link>
            )}
            <Link
              href="/area-restrita/favoritos"
              className="flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-brand-50 rounded-[6px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden lg:inline">Favoritos</span>
            </Link>
            <Link
              href="/area-restrita/meus-certificados"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-ink-primary hover:bg-amber-accent-soft rounded-[6px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <Award className="w-4 h-4" />
              <span>Certificados</span>
            </Link>
            <Link
              href="/area-restrita/historico"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-brand-50 rounded-[6px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <Clock className="w-4 h-4" />
              <span>Histórico</span>
            </Link>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-red-600 hover:bg-red-50 rounded-[6px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
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
