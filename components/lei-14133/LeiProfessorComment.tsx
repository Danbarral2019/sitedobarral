'use client';

import MarkdownContent from '@/components/MarkdownContent';

interface LeiProfessorCommentProps {
  comment: string;
}

export function LeiProfessorComment({ comment }: LeiProfessorCommentProps) {
  return (
    <div className="bg-surface-raised border-l-4 border-brand-600 p-5">
      <h3 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
        <span className="text-amber-accent">✦</span> Comentário do Prof. Daniel Barral
      </h3>
      <div className="prose prose-sm max-w-none">
        <MarkdownContent content={comment} />
      </div>
    </div>
  );
}
