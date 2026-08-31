'use client';

import {
  FileText,
  Heart,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { DocumentResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface DocumentResultCardProps {
  doc: DocumentResult;
  query: string;
  onClick?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onAskAI?: (docTitle: string) => void;
}

export function DocumentResultCard({
  doc,
  query,
  onClick,
  isFavorite,
  onToggleFavorite,
  isSelected,
  onToggleSelect,
  onAskAI,
}: DocumentResultCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[6px] border p-4 hover: transition-all cursor-pointer group ${
        isSelected
          ? 'border-brand-400 bg-brand-50/30 ring-1 ring-brand-300'
          : 'border-border-subtle hover:border-brand-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {onToggleSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`p-1 rounded transition-colors flex-shrink-0 mt-0.5 ${
              isSelected
                ? 'text-brand-600'
                : 'text-ink-muted hover:text-brand-500'
            }`}
            title={isSelected ? 'Desmarcar' : 'Selecionar para PDF'}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        )}
        <div className="p-2 rounded-[6px] bg-brand-50 text-brand-600 flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-ink-primary text-sm line-clamp-2 group-hover:text-brand-600 transition-colors">
              {highlightText(doc.title, query)}
            </h4>
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                className={`p-1.5 rounded-[6px] transition-colors ${
                  isFavorite
                    ? 'text-brand-500 bg-brand-50'
                    : 'text-ink-muted hover:text-brand-500 hover:bg-brand-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
          {doc.description && (
            <p className="text-sm text-ink-muted mt-1 line-clamp-2">
              {highlightText(doc.description, query)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-surface-deep text-ink-muted">
              {doc.category}
            </span>
            {doc.courseName && (
              <span className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-brand-50 text-brand-700">
                {doc.courseName}
              </span>
            )}
            {onAskAI && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAI(doc.title);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                title="Perguntar à IA sobre este documento"
              >
                <Sparkles className="w-3 h-3" />
                Perguntar à IA
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
