'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Pin, Reply, Loader2 } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  isEdited: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: Comment[];
}

interface LessonDiscussionProps {
  lessonId: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `ha ${diffMin} min`;
  if (diffHr < 24) return `ha ${diffHr}h`;
  if (diffDay < 30) return `ha ${diffDay} ${diffDay === 1 ? 'dia' : 'dias'}`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `ha ${diffMonth} ${diffMonth === 1 ? 'mes' : 'meses'}`;
  return `ha ${Math.floor(diffMonth / 12)} ano(s)`;
}

function CommentItem({
  comment,
  isReply,
  onReply,
}: {
  comment: Comment;
  isReply?: boolean;
  onReply: (parentId: string) => void;
}) {
  return (
    <div className={`${isReply ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}`}>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {comment.userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{comment.userName}</span>
          <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
          {comment.isPinned && <Pin className="w-3 h-3 text-amber-500" />}
          {comment.isEdited && <span className="text-[10px] text-gray-300">(editado)</span>}
        </div>
        {comment.isDeleted ? (
          <p className="text-sm text-gray-400 italic ml-9">{comment.content}</p>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed ml-9">{comment.content}</p>
        )}
        {!comment.isDeleted && !isReply && (
          <button
            onClick={() => onReply(comment.id)}
            className="ml-9 mt-1 text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1 transition-colors"
          >
            <Reply className="w-3 h-3" />
            Responder
          </button>
        )}
      </div>
    </div>
  );
}

export default function LessonDiscussion({ lessonId }: LessonDiscussionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/area-restrita/lessons/${lessonId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submitComment = async (content: string, parentId?: string) => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/area-restrita/lessons/${lessonId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), parentId }),
      });
      if (res.ok) {
        setNewComment('');
        setReplyTo(null);
        setReplyText('');
        await fetchComments();
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-brand-600" />
        Discussao
        {comments.length > 0 && (
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </h3>

      {/* New Comment Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitComment(newComment);
        }}
        className="mb-6"
      >
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Compartilhe uma duvida ou comentario..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Publicar
          </button>
        </div>
      </form>

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhum comentario ainda. Seja o primeiro!</p>
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-gray-100">
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                onReply={(parentId) => {
                  setReplyTo(replyTo === parentId ? null : parentId);
                  setReplyText('');
                }}
              />
              {/* Reply form */}
              {replyTo === comment.id && (
                <div className="ml-8 pl-4 pb-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitComment(replyText, comment.id);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Sua resposta..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || isSubmitting}
                      className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
              {/* Replies */}
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply
                  onReply={() => {}}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
