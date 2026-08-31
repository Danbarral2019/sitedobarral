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
 <header className="bg-surface-page/95 border-b border-border-subtle sticky top-0 z-30">
 <div className="max-w-5xl mx-auto px-4 py-3 lg:py-4">
 <div className="flex items-center justify-between">
 {/* User Info */}
 <div className="flex items-center gap-3">
 <SidebarMobileTrigger variant="header" />
 <button
 onClick={onHomeClick}
 className="p-2 rounded-[3px] text-brand-600 hover:bg-brand-50 transition-colors"
 title="Voltar ao Início"
 >
 <Home className="w-5 h-5 lg:w-6 lg:h-6" />
 </button>
 <div className="w-10 h-10 lg:w-12 lg:h-12 bg-brand-600 rounded-full flex items-center justify-center">
 <span className="text-surface-page font-bold text-sm lg:text-lg">
 {userName.charAt(0).toUpperCase()}
 </span>
 </div>
 <div className="hidden sm:block">
 <h2 className="text-sm lg:text-lg font-bold text-ink-primary">
 Bem-vindo, {userName.split(' ')[0]}
 </h2>
 <p className="text-xs lg:text-sm text-ink-secondary">
 {enrolledCount} {enrolledCount === 1 ? 'curso' : 'cursos'}
 </p>
 </div>
 <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-ink-secondary sm:hidden" />
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 lg:gap-3">
 {/* Badge de plano + link de assinatura */}
 {activePlan ? (
 <a
 href="/api/conta/portal"
 className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-surface-raised rounded-[3px] transition-colors font-medium text-sm"
 title="Gerenciar assinatura"
 >
 <CreditCard className="w-4 h-4" />
 <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-surface-deep text-brand-700">
 {activePlan === 'premium' ? 'Premium' : 'Básico'}
 </span>
 </a>
 ) : (
 <Link
 href="/planos"
 className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-surface-raised rounded-[3px] transition-colors font-medium text-sm"
 >
 <CreditCard className="w-4 h-4" />
 <span>Planos</span>
 </Link>
 )}
 <Link
 href="/area-restrita/favoritos"
 className="flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-ink-secondary hover:bg-surface-raised rounded-[3px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-amber-accent focus-visible:ring-offset-2"
 >
 <Heart className="w-4 h-4" />
 <span className="hidden lg:inline">Favoritos</span>
 </Link>
 <Link
 href="/area-restrita/meus-certificados"
 className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-amber-accent hover:bg-surface-raised rounded-[3px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-amber-accent focus-visible:ring-offset-2"
 >
 <Award className="w-4 h-4" />
 <span>Certificados</span>
 </Link>
 <Link
 href="/area-restrita/historico"
 className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-brand-600 hover:bg-brand-50 rounded-[3px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-amber-accent focus-visible:ring-offset-2"
 >
 <Clock className="w-4 h-4" />
 <span>Histórico</span>
 </Link>
 <button
 onClick={onLogout}
 className="flex items-center gap-1.5 px-3 py-2 text-ink-secondary hover:text-semantic-error hover:bg-surface-raised rounded-[3px] transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-amber-accent focus-visible:ring-offset-2"
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
