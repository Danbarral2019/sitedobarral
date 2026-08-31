'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface LeiMobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function LeiMobileDrawer({ open, onClose, children }: LeiMobileDrawerProps) {
  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute top-0 left-0 h-full w-[80vw] max-w-sm bg-surface-page border-r border-border-subtle overflow-y-auto">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-surface-page z-10">
          <h2 className="text-lg font-bold text-ink-primary">Estrutura da Lei</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-deep rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
