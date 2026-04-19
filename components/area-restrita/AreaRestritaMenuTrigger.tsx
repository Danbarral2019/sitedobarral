'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AreaRestritaMenuDrawer } from './AreaRestritaMenuDrawer';

interface Props {
  /** Variante visual: 'header' = botão com texto ao lado; 'bottom' = vertical */
  variant?: 'header' | 'bottom';
}

export function AreaRestritaMenuTrigger({ variant = 'header' }: Props) {
  const [open, setOpen] = useState(false);

  if (variant === 'bottom') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center justify-center h-full text-gray-600 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
        <AreaRestritaMenuDrawer open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors font-medium text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="Abrir menu"
      >
        <Menu className="w-4 h-4" />
        <span className="hidden sm:inline">Menu</span>
      </button>
      <AreaRestritaMenuDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default AreaRestritaMenuTrigger;
