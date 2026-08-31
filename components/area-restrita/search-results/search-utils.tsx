'use client';

import {
  FileText,
  Scale,
  BookOpen,
  Video,
  Globe,
  HelpCircle,
  Newspaper,
  Gavel,
} from 'lucide-react';
import type { ContentType } from '@/lib/types/global-search';

export const TYPE_ICONS: Record<ContentType, typeof FileText> = {
  document: FileText,
  'course-material': FileText,
  lei: Scale,
  glossary: BookOpen,
  faq: HelpCircle,
  video: Video,
  blog: Newspaper,
  site: Globe,
  'legislative-act': Gavel,
};

// Highlight search term in text
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Source icon by type
export function SourceIcon({ category }: { category: string }) {
  switch (category) {
    case 'lei-artigo':
      return <Scale className="w-3 h-3" />;
    case 'ato-normativo':
      return <Gavel className="w-3 h-3" />;
    case 'acordao':
      return <Gavel className="w-3 h-3" />;
    case 'manual-tcu':
      return <BookOpen className="w-3 h-3" />;
    case 'apostila':
    case 'conteudo-programatico':
    case 'outro':
      return <BookOpen className="w-3 h-3" />;
    case 'enunciados':
      return <Scale className="w-3 h-3" />;
    case 'orientacao-normativa':
      return <Gavel className="w-3 h-3" />;
    case 'decor':
    case 'parecer-vinculante':
      return <FileText className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
}

/** Negrito em **texto**, usado tanto no título quanto no corpo da linha. */
function formatBold(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  );
}

// Format markdown-like text in AI answer (headings, bold, bullet points)
export function formatLine(text: string): React.ReactNode {
  // Títulos de seção. O sintetizador estrutura respostas longas com "## " e
  // "### ", e sem este caso os marcadores apareciam crus na tela do assinante.
  const headingMatch = text.match(/^(#{1,4})\s+(.*)/);
  if (headingMatch) {
    return (
      <span className="block font-bold text-gray-900 mt-3 mb-1">
        {formatBold(headingMatch[2])}
      </span>
    );
  }

  // Check if line is a bullet point
  const bulletMatch = text.match(/^(\s*)[*\-]\s+(.*)/);
  const content = bulletMatch ? bulletMatch[2] : text;
  const isBullet = !!bulletMatch;

  const formatted = formatBold(content);

  if (isBullet) {
    return <span className="flex gap-1.5 ml-2"><span className="text-purple-400">&#8226;</span><span>{formatted}</span></span>;
  }
  return formatted;
}
