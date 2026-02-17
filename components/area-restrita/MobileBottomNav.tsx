'use client';

import Link from 'next/link';
import { LogOut, Heart, CheckCircle } from 'lucide-react';

interface MobileBottomNavProps {
  onLogout: () => void;
}

export function MobileBottomNav({ onLogout }: MobileBottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl z-50 pb-safe">
      <div className="flex items-center justify-around h-16">
        <Link
          href="/area-restrita"
          className="flex flex-col items-center justify-center flex-1 h-full text-brand-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <CheckCircle className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Início</span>
        </Link>
        <Link
          href="/area-restrita/favoritos"
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-pink-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Heart className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Favoritos</span>
        </Link>
        <button
          onClick={onLogout}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <LogOut className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Sair</span>
        </button>
      </div>
    </nav>
  );
}
