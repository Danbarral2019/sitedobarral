'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Building, ArrowLeft, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';

export default function CursoBloqueadoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const courseId = searchParams.get('courseId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    interesse: 'proxima-turma',
    mensagem: '',
  });

  // Buscar dados do curso
  const course = courses.find(c => c.id === courseId);

  useEffect(() => {
    if (!courseId || !course) {
      router.push('/area-restrita');
    }
  }, [courseId, course, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.name || '',
          email: user?.email || '',
          phone: '',
          courseInterest: `${course?.title} - ${formData.interesse === 'proxima-turma' ? 'Próxima turma' : 'Cursos de curta duração'}`,
          message: formData.mensagem || `Interesse em: ${course?.title}\nTipo: ${formData.interesse === 'proxima-turma' ? 'Participar de próxima turma' : 'Cursos de curta duração'}`,
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setTimeout(() => {
          router.push('/area-restrita');
        }, 3000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!course) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Botão voltar */}
        <button
          onClick={() => router.push('/area-restrita')}
          className="flex items-center gap-2 text-ink-secondary hover:text-brand-600 mb-6 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para área restrita
        </button>

        {/* Card principal */}
        <div className="bg-white rounded-[6px] border-2 border-border-subtle overflow-hidden">
          {/* Header */}
          <div className="bg-amber-accent text-white p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Curso Bloqueado</h1>
                <p className="text-amber-accent-deep">Você não está matriculado neste curso</p>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-8">
            {/* Informações do curso */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-ink-primary mb-3">{course.title}</h2>
              <p className="text-ink-secondary leading-relaxed mb-4">{course.description}</p>
              <div className="inline-block bg-brand-50 px-4 py-2 rounded-[6px] border border-brand-200">
                <p className="text-sm text-brand-900 font-medium">
                  <strong>Duração:</strong> {course.duration}
                </p>
              </div>
            </div>

            {/* Mensagem de status (sucesso/erro) */}
            {submitStatus === 'success' && (
              <div className="mb-6 p-4 bg-green-50 border-2 border-green-300 rounded-[6px] flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-green-900 mb-1">Interesse registrado com sucesso!</h3>
                  <p className="text-sm text-green-800">
                    Entraremos em contato em breve. Redirecionando...
                  </p>
                </div>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-[6px] flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-900 mb-1">Erro ao enviar</h3>
                  <p className="text-sm text-red-800">
                    Ocorreu um erro. Por favor, tente novamente ou entre em contato diretamente.
                  </p>
                </div>
              </div>
            )}

            {/* CTA de Assinatura */}
            <div className="mb-8 p-6 bg-brand-50 border-2 border-brand-200 rounded-[6px]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-brand-600 rounded-[6px] flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-ink-primary mb-2">Acesso imediato via assinatura</h3>
                  <p className="text-ink-secondary text-sm mb-4">
                    Assine um de nossos planos e tenha acesso imediato a este curso e todo o material exclusivo.
                  </p>
                  <Link
                    href="/planos"
                    className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-[6px] font-bold hover:bg-brand-700 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Ver Planos de Assinatura
                  </Link>
                </div>
              </div>
            </div>

            {/* Formulário de interesse */}
            {submitStatus !== 'success' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-brand-50 p-6 rounded-[6px] border-2 border-brand-200">
                  <h3 className="text-xl font-bold text-ink-primary mb-4">Demonstrar Interesse</h3>
                  <p className="text-ink-secondary mb-6">
                    Preencha o formulário abaixo e entraremos em contato para informar sobre novas turmas ou organizar cursos de curta duração.
                  </p>

                  {/* Tipo de interesse */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-ink-primary mb-3">
                      Qual o seu interesse?
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 bg-white border-2 border-border-subtle rounded-[6px] cursor-pointer hover:border-brand-400 transition-colors">
                        <input
                          type="radio"
                          name="interesse"
                          value="proxima-turma"
                          checked={formData.interesse === 'proxima-turma'}
                          onChange={(e) => setFormData({ ...formData, interesse: e.target.value })}
                          className="w-5 h-5 text-brand-600"
                        />
                        <div className="flex items-center gap-2">
                          <Mail className="w-5 h-5 text-brand-600" />
                          <div>
                            <p className="font-bold text-ink-primary">Participar de uma próxima turma</p>
                            <p className="text-sm text-ink-muted">Ser notificado quando houver nova turma</p>
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white border-2 border-border-subtle rounded-[6px] cursor-pointer hover:border-brand-400 transition-colors">
                        <input
                          type="radio"
                          name="interesse"
                          value="in-company"
                          checked={formData.interesse === 'in-company'}
                          onChange={(e) => setFormData({ ...formData, interesse: e.target.value })}
                          className="w-5 h-5 text-brand-600"
                        />
                        <div className="flex items-center gap-2">
                          <Building className="w-5 h-5 text-brand-600" />
                          <div>
                            <p className="font-bold text-ink-primary">Solicitar cursos de curta duração</p>
                            <p className="text-sm text-ink-muted">Curso exclusivo para sua organização</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Mensagem adicional */}
                  <div>
                    <label className="block text-sm font-bold text-ink-primary mb-2">
                      Mensagem adicional (opcional)
                    </label>
                    <textarea
                      value={formData.mensagem}
                      onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-border-subtle rounded-[6px] focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-colors resize-none"
                      placeholder="Compartilhe mais detalhes sobre seu interesse..."
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-brand-600 text-white px-6 py-4 rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-border-subtle"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Interesse'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/area-restrita')}
                    className="px-6 py-4 bg-surface-deep text-ink-secondary rounded-[6px] font-bold hover:bg-border-strong transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Informações de contato alternativas */}
            <div className="mt-8 p-6 bg-surface-raised border-2 border-border-subtle rounded-[6px]">
              <h3 className="font-bold text-ink-primary mb-3">Ou entre em contato diretamente:</h3>
              <div className="space-y-2 text-sm text-ink-secondary">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-600" />
                  <strong>Email:</strong> contato@professorbarral.com.br
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
