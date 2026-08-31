'use client';

import MarkdownContent from '@/components/MarkdownContent';

interface LeiProfessorCommentProps {
  comment: string;
}

export function LeiProfessorComment({ comment }: LeiProfessorCommentProps) {
  return (
    <div className="bg-amber-accent-soft/40 border-2 border-amber-accent-soft rounded-[6px] p-6">
      <h3 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
        <span className="text-amber-accent-deep">✦</span> Comentário do Prof. Daniel Barral
      </h3>
      <div className="prose prose-sm max-w-none">
        <MarkdownContent content={comment} />
      </div>
    </div>
  );
}
