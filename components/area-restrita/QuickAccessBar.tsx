'use client';

import Link from 'next/link';
import { Scale, Sparkles, Heart, TrendingUp, Gavel, BookOpen } from 'lucide-react';

interface QuickAccessBarProps {
 onShowInlineView: (view: 'legislative-acts' | 'glossary') => void;
}

const NAV_PILLS = [
 { label: 'Lei 14.133', icon: Scale, href: '/area-restrita/lei-comentada' },
 { label: 'Assistente IA', icon: Sparkles, href: '/area-restrita/assistente' },
 { label: 'Favoritos', icon: Heart, href: '/area-restrita/favoritos' },
 { label: 'Meu Progresso', icon: TrendingUp, href: '/area-restrita/meu-progresso' },
] as const;

const ACTION_PILLS = [
 { label: 'Atos Normativos', icon: Gavel, view: 'legislative-acts' as const },
 { label: 'Glossário', icon: BookOpen, view: 'glossary' as const },
] as const;

export function QuickAccessBar({ onShowInlineView }: QuickAccessBarProps) {
 return (
 <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-wrap scrollbar-hide">
 {NAV_PILLS.map((pill) => {
 const Icon = pill.icon;
 return (
 <Link
 key={pill.href}
 href={pill.href}
 className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-surface-page border border-border-subtle text-sm font-medium text-ink-secondary hover:border-brand-300 hover:bg-brand-50 transition-all whitespace-nowrap"
 >
 <Icon className="w-4 h-4 text-brand-600" />
 {pill.label}
 </Link>
 );
 })}
 {ACTION_PILLS.map((pill) => {
 const Icon = pill.icon;
 return (
 <button
 key={pill.view}
 onClick={() => onShowInlineView(pill.view)}
 className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-surface-page border border-border-subtle text-sm font-medium text-ink-secondary hover:border-brand-300 hover:bg-brand-50 transition-all whitespace-nowrap"
 >
 <Icon className="w-4 h-4 text-brand-600" />
 {pill.label}
 </button>
 );
 })}

 <style jsx>{`
 .scrollbar-hide::-webkit-scrollbar {
 display: none;
 }
 .scrollbar-hide {
 -ms-overflow-style: none;
 scrollbar-width: none;
 }
 `}</style>
 </div>
 );
}
