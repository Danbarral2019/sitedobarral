'use client';

import Link from 'next/link';
import { FileText, Link as LinkIcon, Play, Settings, ClipboardCheck } from 'lucide-react';
import type { LessonTabId } from '@/hooks/use-lesson-editor';

interface LessonEditorTabsProps {
  activeTab: LessonTabId;
  onChange: (tab: LessonTabId) => void;
  quizLink: string;
}

const TABS: { id: LessonTabId; label: string; icon: typeof FileText }[] = [
  { id: 'conteudo', label: 'Conteudo', icon: FileText },
  { id: 'documentos', label: 'Documentos', icon: LinkIcon },
  { id: 'videos', label: 'Videos', icon: Play },
  { id: 'configuracoes', label: 'Configuracoes', icon: Settings },
];

export function LessonEditorTabs({ activeTab, onChange, quizLink }: LessonEditorTabsProps) {
  return (
    <div className="flex border-b border-gray-200 mb-6">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
      <Link
        href={quizLink}
        className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-purple-600 hover:text-purple-700 hover:border-purple-300 transition-colors"
      >
        <ClipboardCheck className="w-4 h-4" />
        Quiz
      </Link>
    </div>
  );
}
