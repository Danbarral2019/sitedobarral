'use client';

import MarkdownContent from '@/components/MarkdownContent';

interface LeiProfessorCommentProps {
  comment: string;
}

export function LeiProfessorComment({ comment }: LeiProfessorCommentProps) {
  return (
    <div className="bg-amber-50/40 border-2 border-amber-200 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-amber-500">✦</span> Comentário do Prof. Daniel Barral
      </h3>
      <div className="prose prose-sm max-w-none">
        <MarkdownContent content={comment} />
      </div>
    </div>
  );
}
