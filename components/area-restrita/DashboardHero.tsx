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
    <section className="bg-white shadow-sm rounded-2xl p-6 lg:p-8">
      <h2 className="font-serif text-brand-800 text-lg font-bold mb-1">
        Pesquise em todo o acervo jurídico
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Documentos, artigos da Lei, pareceres, acórdãos e mais
      </p>
      {children}
      <p className="text-xs text-gray-400 mt-2 hidden lg:block">
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">
          {isMac ? '⌘' : 'Ctrl'}
        </kbd>
        {' + '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">
          K
        </kbd>
        {' para buscar de qualquer página'}
      </p>
    </section>
  );
}
