'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Pencil, FileText, BookOpen, Link as LinkIcon, ScrollText, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CommentEditor } from './CommentEditor';
import { CrossRefsEditor } from './CrossRefsEditor';
import { ReadingsEditor } from './ReadingsEditor';
import { LinkedDocsEditor } from './LinkedDocsEditor';
import { LinkedActsEditor } from './LinkedActsEditor';

interface CrossRef {
  id: string;
  targetNumber: string;
  note: string;
  order: number;
}
interface Reading {
  id: string;
  kind: 'internal' | 'external';
  internalType?: string | null;
  internalId?: string | null;
  externalUrl?: string | null;
  externalType?: string | null;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  order: number;
}
interface LinkedDoc {
  id: string;
  title: string;
  category: string | null;
  isPublic: boolean;
  notesImportance: string | null;
}
interface LinkedAct {
  id: string;
  fullNumber: string;
  title: string;
  ementa: string;
  type: string;
  hierarchyLevel: number;
  esfera: string;
  importance: string | null;
}
interface Article {
  numero: string;
  titulo: string | null;
  capitulo: string;
  capituloCompleto: string | null;
  ementa: string;
  professorComment: string | null;
  commentUpdatedAt: string | null;
  crossRefs: CrossRef[];
  suggestedReadings: Reading[];
}

interface Props {
  numero: string;
  /**
   * Próximo artigo pendente na fila. Quando existe, o editor oferece
   * "Salvar e próximo" — escrever vinte comentários sem voltar à árvore a
   * cada um era o que faltava, não o editor.
   */
  proximoNumero?: string | null;
  onIrParaProximo?: (numero: string) => void;
}

export function ArticleEditorMain({ numero, proximoNumero, onIrParaProximo }: Props) {
  const { error: errorToast, success: successToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [linkedActs, setLinkedActs] = useState<LinkedAct[]>([]);
  const [showCommentEditor, setShowCommentEditor] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/lei-14133/articles/${numero}`);
      if (!r.ok) throw new Error('Erro ao carregar artigo');
      const data = await r.json();
      setArticle(data.article);
      setLinkedDocs(data.linkedDocuments);
      setLinkedActs(data.linkedActs);
    } catch (err) {
      errorToast('Erro', err instanceof Error ? err.message : 'desconhecido');
    } finally {
      setLoading(false);
    }
  }, [numero, errorToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const salvarComentario = async (markdown: string) => {
    const r = await fetch(`/api/admin/lei-14133/articles/${numero}/comment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'Erro ao salvar');
    }
  };

  const handleSaveComment = async (markdown: string) => {
    await salvarComentario(markdown);
    successToast('Comentário salvo');
    setShowCommentEditor(false);
    fetchAll();
  };

  const handleSaveAndNext = async (markdown: string) => {
    await salvarComentario(markdown);
    successToast('Comentário salvo. Próximo artigo.');
    setShowCommentEditor(false);
    if (proximoNumero && onIrParaProximo) onIrParaProximo(proximoNumero);
  };

  if (loading || !article) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg">Art. {article.numero}</span>
          {article.titulo && <span className="text-sm text-gray-600">{article.titulo}</span>}
        </div>
        {article.capituloCompleto && <p className="text-sm text-gray-500 mb-3">{article.capituloCompleto}</p>}
        <div className="prose max-w-none text-gray-800 whitespace-pre-line">{article.ementa}</div>
      </div>

      <section className="bg-white rounded-lg shadow-md p-6">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Comentário do Prof.
          </h2>
          <button
            onClick={() => setShowCommentEditor(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        </header>
        {article.professorComment ? (
          <div className="prose prose-sm max-w-none whitespace-pre-line bg-amber-50/30 border-l-4 border-amber-300 p-3 rounded-r">
            {article.professorComment}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Nenhum comentário ainda. Clique em Editar para começar.</p>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Leitura combinada (vínculos com outros artigos)
        </h2>
        <CrossRefsEditor numero={numero} initial={article.crossRefs} onChanged={fetchAll} />
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-emerald-600" />
          Sugestões de leitura
        </h2>
        <ReadingsEditor numero={numero} initial={article.suggestedReadings} onChanged={fetchAll} />
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Documentos vinculados ({linkedDocs.length})
        </h2>
        <LinkedDocsEditor numero={numero} linked={linkedDocs} onChanged={fetchAll} />
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-violet-600" />
          Atos normativos vinculados ({linkedActs.length})
        </h2>
        <LinkedActsEditor numero={numero} linked={linkedActs} onChanged={fetchAll} />
      </section>

      {showCommentEditor && (
        <CommentEditor
          initial={article.professorComment || ''}
          onSave={handleSaveComment}
          onSaveAndNext={proximoNumero && onIrParaProximo ? handleSaveAndNext : undefined}
          proximoNumero={proximoNumero ?? null}
          onCancel={() => setShowCommentEditor(false)}
        />
      )}
    </div>
  );
}
