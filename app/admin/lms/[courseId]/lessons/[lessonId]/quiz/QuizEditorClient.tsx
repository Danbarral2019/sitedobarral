'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardCheck, Plus, Trash2, Save, GripVertical, Eye, EyeOff,
  Loader2, ChevronRight, Settings, AlertTriangle, CheckCircle
} from 'lucide-react';
import { getCourseById } from '@/lib/courses';
import AdminLayout from '@/components/AdminLayout';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: string;
  type: string;
  text: string;
  options: QuizOption[];
  explanation: string | null;
  displayOrder: number;
  points: number;
}

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  isPublished: boolean;
  questions: QuizQuestion[];
  _count: { attempts: number };
  lesson: { id: string; title: string; slug: string; moduleId: string };
}

export default function QuizEditorClient({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const router = useRouter();
  const course = getCourseById(courseId);

  const [isLoading, setIsLoading] = useState(true);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [noQuiz, setNoQuiz] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeSection, setActiveSection] = useState<'questions' | 'settings'>('questions');

  // Create quiz form
  const [createTitle, setCreateTitle] = useState('');

  // New question form
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [qType, setQType] = useState<'multiple_choice' | 'true_false'>('multiple_choice');
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState<QuizOption[]>([
    { id: '1', text: '', isCorrect: true },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false },
  ]);
  const [qExplanation, setQExplanation] = useState('');
  const [qPoints, setQPoints] = useState(1);

  // Settings form
  const [settings, setSettings] = useState({
    title: '',
    description: '',
    passingScore: 60,
    maxAttempts: '',
    timeLimitMinutes: '',
    shuffleQuestions: false,
    isPublished: false,
  });

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) { router.push('/validar-acesso'); return; }
      const data = await response.json();
      if (data.user.role !== 'admin') { router.push('/area-restrita'); return; }
    } catch { router.push('/validar-acesso'); }
  }, [router]);

  const loadQuiz = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/quizzes?lessonId=${lessonId}`);
      if (!res.ok) return;
      const data = await res.json();
      const quizzes = data.quizzes || [];
      if (quizzes.length === 0) {
        setNoQuiz(true);
        return;
      }
      // Load full quiz with questions
      const quizRes = await fetch(`/api/admin/quizzes/${quizzes[0].id}`);
      if (!quizRes.ok) return;
      const quizData = await quizRes.json();
      setQuiz(quizData.quiz);
      setNoQuiz(false);
      setSettings({
        title: quizData.quiz.title,
        description: quizData.quiz.description || '',
        passingScore: quizData.quiz.passingScore,
        maxAttempts: quizData.quiz.maxAttempts?.toString() || '',
        timeLimitMinutes: quizData.quiz.timeLimitMinutes?.toString() || '',
        shuffleQuestions: quizData.quiz.shuffleQuestions,
        isPublished: quizData.quiz.isPublished,
      });
    } catch {
      // silently fail
    }
  }, [lessonId]);

  useEffect(() => {
    const init = async () => {
      await verifyAdmin();
      await loadQuiz();
      setIsLoading(false);
    };
    init();
  }, [verifyAdmin, loadQuiz]);

  // ── Create Quiz ──
  const handleCreateQuiz = async () => {
    if (!createTitle.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, title: createTitle }),
      });
      if (res.ok) {
        await loadQuiz();
        setCreateTitle('');
      }
    } catch {} finally { setIsSaving(false); }
  };

  // ── Save Settings ──
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: settings.title,
          description: settings.description || null,
          passingScore: settings.passingScore,
          maxAttempts: settings.maxAttempts ? parseInt(settings.maxAttempts) : null,
          timeLimitMinutes: settings.timeLimitMinutes ? parseInt(settings.timeLimitMinutes) : null,
          shuffleQuestions: settings.shuffleQuestions,
          isPublished: settings.isPublished,
        }),
      });
      if (res.ok) {
        setSaveMessage('Configuracoes salvas!');
        await loadQuiz();
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch { setSaveMessage('Erro ao salvar.'); }
    finally { setIsSaving(false); }
  };

  // ── Question CRUD ──
  const resetQuestionForm = () => {
    setQType('multiple_choice');
    setQText('');
    setQOptions([
      { id: '1', text: '', isCorrect: true },
      { id: '2', text: '', isCorrect: false },
      { id: '3', text: '', isCorrect: false },
      { id: '4', text: '', isCorrect: false },
    ]);
    setQExplanation('');
    setQPoints(1);
    setEditingQuestion(null);
    setShowQuestionForm(false);
  };

  const handleEditQuestion = (q: QuizQuestion) => {
    setEditingQuestion(q);
    setQType(q.type as 'multiple_choice' | 'true_false');
    setQText(q.text);
    setQOptions(q.options);
    setQExplanation(q.explanation || '');
    setQPoints(q.points);
    setShowQuestionForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!quiz || !qText.trim()) return;
    setIsSaving(true);

    const payload = {
      type: qType,
      text: qText,
      options: qOptions.filter(o => o.text.trim()),
      explanation: qExplanation || undefined,
      points: qPoints,
    };

    try {
      if (editingQuestion) {
        await fetch(`/api/admin/quizzes/${quiz.id}/questions/${editingQuestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/admin/quizzes/${quiz.id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      resetQuestionForm();
      await loadQuiz();
    } catch {} finally { setIsSaving(false); }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!quiz) return;
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}/questions/${questionId}`, {
        method: 'DELETE',
      });
      await loadQuiz();
    } catch {}
  };

  const handleDeleteQuiz = async () => {
    if (!quiz || !confirm('Tem certeza que deseja excluir este quiz? Todas as perguntas e tentativas serao perdidas.')) return;
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}`, { method: 'DELETE' });
      setQuiz(null);
      setNoQuiz(true);
    } catch {}
  };

  const handleSetCorrect = (optId: string) => {
    setQOptions(prev => prev.map(o => ({ ...o, isCorrect: o.id === optId })));
  };

  const handleOptionTextChange = (optId: string, text: string) => {
    setQOptions(prev => prev.map(o => o.id === optId ? { ...o, text } : o));
  };

  const handleAddOption = () => {
    setQOptions(prev => [...prev, { id: String(Date.now()), text: '', isCorrect: false }]);
  };

  const handleRemoveOption = (optId: string) => {
    if (qOptions.length <= 2) return;
    setQOptions(prev => prev.filter(o => o.id !== optId));
  };

  const handleTypeChange = (type: 'multiple_choice' | 'true_false') => {
    setQType(type);
    if (type === 'true_false') {
      setQOptions([
        { id: 'true', text: 'Verdadeiro', isCorrect: true },
        { id: 'false', text: 'Falso', isCorrect: false },
      ]);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin/lms" className="hover:text-gray-700">LMS</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/admin/lms/${courseId}`} className="hover:text-gray-700">
              {course?.title ? (course.title.length > 25 ? course.title.substring(0, 25) + '...' : course.title) : 'Curso'}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/admin/lms/${courseId}/lessons/${lessonId}`} className="hover:text-gray-700">
              Licao
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">Quiz</span>
          </nav>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <ClipboardCheck className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {quiz ? quiz.title : 'Quiz da Licao'}
            </h1>
            {quiz && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                quiz.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {quiz.isPublished ? 'Publicado' : 'Rascunho'}
              </span>
            )}
          </div>

          {/* No quiz yet — create */}
          {noQuiz && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Nenhum quiz para esta licao</h2>
              <p className="text-sm text-gray-500 mb-6">Crie um quiz para avaliar o aprendizado dos alunos.</p>
              <div className="flex items-center gap-3 max-w-md mx-auto">
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="Titulo do quiz..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                />
                <button
                  onClick={handleCreateQuiz}
                  disabled={isSaving || !createTitle.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Quiz'}
                </button>
              </div>
            </div>
          )}

          {/* Quiz editor */}
          {quiz && (
            <>
              {/* Section tabs */}
              <div className="flex gap-1 mb-6">
                <button
                  onClick={() => setActiveSection('questions')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === 'questions' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Perguntas ({quiz.questions.length})
                </button>
                <button
                  onClick={() => setActiveSection('settings')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activeSection === 'settings' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Configuracoes
                </button>
              </div>

              {saveMessage && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
                  saveMessage.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {saveMessage}
                </div>
              )}

              {/* ── Questions Section ── */}
              {activeSection === 'questions' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Perguntas</h3>
                    <button
                      onClick={() => { resetQuestionForm(); setShowQuestionForm(true); }}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Pergunta
                    </button>
                  </div>

                  {quiz.questions.length === 0 && !showQuestionForm && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Nenhuma pergunta adicionada
                    </div>
                  )}

                  {/* Questions list */}
                  <div className="space-y-3 mb-4">
                    {quiz.questions.map((q, idx) => (
                      <div key={q.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-purple-600">{idx + 1}.</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              q.type === 'true_false' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                            }`}>
                              {q.type === 'true_false' ? 'V/F' : 'Multipla'}
                            </span>
                            {q.points > 1 && (
                              <span className="text-xs text-gray-400">{q.points} pts</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 line-clamp-2">{q.text}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {q.options.map(opt => (
                              <span key={opt.id} className={`text-xs px-2 py-0.5 rounded ${
                                opt.isCorrect ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {opt.text.length > 30 ? opt.text.substring(0, 30) + '...' : opt.text}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditQuestion(q)}
                            className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-500"
                            title="Editar"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Question form */}
                  {showQuestionForm && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h4 className="font-semibold text-gray-900 mb-4">
                        {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
                      </h4>
                      <div className="space-y-4">
                        {/* Type */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleTypeChange('multiple_choice')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              qType === 'multiple_choice' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            Multipla Escolha
                          </button>
                          <button
                            onClick={() => handleTypeChange('true_false')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              qType === 'true_false' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            Verdadeiro / Falso
                          </button>
                        </div>

                        {/* Question text */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pergunta</label>
                          <textarea
                            value={qText}
                            onChange={e => setQText(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                            placeholder="Digite a pergunta..."
                          />
                        </div>

                        {/* Options */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Opcoes (clique no circulo para marcar a correta)
                          </label>
                          <div className="space-y-2">
                            {qOptions.map(opt => (
                              <div key={opt.id} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSetCorrect(opt.id)}
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                    opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                                  }`}
                                >
                                  {opt.isCorrect && <CheckCircle className="w-3 h-3 text-white" />}
                                </button>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={e => handleOptionTextChange(opt.id, e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                                  placeholder="Texto da opcao..."
                                  disabled={qType === 'true_false'}
                                />
                                {qType === 'multiple_choice' && qOptions.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(opt.id)}
                                    className="p-1 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {qType === 'multiple_choice' && qOptions.length < 6 && (
                            <button
                              type="button"
                              onClick={handleAddOption}
                              className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              + Adicionar opcao
                            </button>
                          )}
                        </div>

                        {/* Explanation */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Explicacao (exibida apos responder)
                          </label>
                          <textarea
                            value={qExplanation}
                            onChange={e => setQExplanation(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                            placeholder="Explicacao da resposta correta..."
                          />
                        </div>

                        {/* Points */}
                        <div className="w-32">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pontos</label>
                          <input
                            type="number"
                            value={qPoints}
                            onChange={e => setQPoints(parseInt(e.target.value) || 1)}
                            min={1}
                            max={100}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                          />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={resetQuestionForm}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveQuestion}
                            disabled={isSaving || !qText.trim() || qOptions.filter(o => o.text.trim()).length < 2}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editingQuestion ? 'Atualizar' : 'Salvar Pergunta'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Settings Section ── */}
              {activeSection === 'settings' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo</label>
                      <input
                        type="text"
                        value={settings.title}
                        onChange={e => setSettings({ ...settings, title: e.target.value })}
                        required
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao</label>
                      <textarea
                        value={settings.description}
                        onChange={e => setSettings({ ...settings, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                        placeholder="Descricao do quiz..."
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Nota minima (%)</label>
                        <input
                          type="number"
                          value={settings.passingScore}
                          onChange={e => setSettings({ ...settings, passingScore: parseInt(e.target.value) || 60 })}
                          min={0}
                          max={100}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Max tentativas</label>
                        <input
                          type="number"
                          value={settings.maxAttempts}
                          onChange={e => setSettings({ ...settings, maxAttempts: e.target.value })}
                          min={1}
                          placeholder="Ilimitado"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Tempo (min)</label>
                        <input
                          type="number"
                          value={settings.timeLimitMinutes}
                          onChange={e => setSettings({ ...settings, timeLimitMinutes: e.target.value })}
                          min={1}
                          placeholder="Sem limite"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-900">Embaralhar perguntas</label>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, shuffleQuestions: !settings.shuffleQuestions })}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            settings.shuffleQuestions ? 'bg-purple-600' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            settings.shuffleQuestions ? 'translate-x-5' : ''
                          }`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-900">Publicado</label>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, isPublished: !settings.isPublished })}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            settings.isPublished ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            settings.isPublished ? 'translate-x-5' : ''
                          }`} />
                        </button>
                        <span className="text-sm text-gray-500">
                          {settings.isPublished ? <Eye className="w-4 h-4 text-green-600 inline" /> : <EyeOff className="w-4 h-4 text-gray-400 inline" />}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Configuracoes
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteQuiz}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Quiz
                      </button>
                    </div>

                    {quiz._count.attempts > 0 && (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg px-4 py-3 text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        Este quiz ja possui {quiz._count.attempts} tentativa{quiz._count.attempts > 1 ? 's' : ''} de alunos.
                      </div>
                    )}
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
