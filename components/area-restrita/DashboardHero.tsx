'use client';

import { ReactNode, useEffect, useState } from 'react';

interface DashboardHeroProps {
 children: ReactNode;
}

export function DashboardHero({ children }: DashboardHeroProps) {
 const [isMac, setIsMac] = useState(false);

 useEffect(() => {
 setIsMac(navigator.platform.toUpperCase().includes('MAC'));
 }, []);

 return (
 <section className="bg-surface-page rounded-md p-6 lg:p-8">
 <h2 className="font-serif text-brand-800 text-lg font-bold mb-1">
 Pesquise em todo o acervo jurídico
 </h2>
 <p className="text-sm text-ink-muted mb-4">
 Busca rápida por palavras-chave em documentos, artigos da Lei, pareceres e acórdãos. Para perguntas em linguagem natural com histórico e citações, use o <strong>Assistente IA</strong>.
 </p>
 {children}
 <p className="text-xs text-ink-muted mt-2 hidden lg:block">
 <kbd className="px-1.5 py-0.5 bg-surface-deep border border-border-subtle rounded text-[10px] font-mono">
 {isMac ? '⌘' : 'Ctrl'}
 </kbd>
 {' + '}
 <kbd className="px-1.5 py-0.5 bg-surface-deep border border-border-subtle rounded text-[10px] font-mono">
 K
 </kbd>
 {' para buscar de qualquer página'}
 </p>
 </section>
 );
}
