'use client';

import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';

interface ModuleManagerHeaderProps {
  courseTitle: string;
  modulesCount: number;
  onCreateModule: () => void;
}

export function ModuleManagerHeader({ courseTitle, modulesCount, onCreateModule }: ModuleManagerHeaderProps) {
  return (
    <>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin" className="hover:text-gray-700">Admin</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/lms" className="hover:text-gray-700">LMS</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">{courseTitle}</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{courseTitle}</h1>
          <p className="text-gray-600 mt-1">
            {modulesCount} {modulesCount === 1 ? 'modulo' : 'modulos'}
          </p>
        </div>
        <button
          onClick={onCreateModule}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Modulo
        </button>
      </div>
    </>
  );
}
