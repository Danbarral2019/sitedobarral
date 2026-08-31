'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Guard against SSR - window only exists on client
    if (typeof window === 'undefined') return;

    const toggleVisibility = () => {
      // Mostrar o botão quando rolar mais de 300px
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    // Guard against SSR
    if (typeof window === 'undefined') return;

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 bg-brand-600 text-white p-3 rounded-full hover:from-brand-700 hover:to-brand-700 transition-all transform hover:scale-110 active:scale-95 group border border-border-subtle"
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
    >
      <ArrowUp className="w-6 h-6" />
      <span className="absolute -top-10 right-0 bg-brand-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Voltar ao topo
      </span>
    </button>
  );
}
