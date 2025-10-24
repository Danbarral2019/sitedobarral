'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Phone, Building, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { courses } from '@/data/courses';
import { useAuth } from '@/hooks/use-auth';

// Força renderização dinâmica (não pre-render) pois depende de query params
export const dynamic = 'force-dynamic';

export default function CursoBloqueadoPage() {
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
          courseInterest: `${course?.title} - ${formData.interesse === 'proxima-turma' ? 'Próxima turma' : 'Curso in company'}`,
          message: formData.mensagem || `Interesse em: ${course?.title}\nTipo: ${formData.interesse === 'proxima-turma' ? 'Participar de próxima turma' : 'Curso in company'}`,
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Botão voltar */}
        <button
          onClick={() => router.push('/area-restrita')}
          className="flex items-center gap-2 text-gray-700 hover:text-blue-600 mb-6 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para área restrita
        </button>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Curso Bloqueado</h1>
                <p className="text-orange-100">Você não está matriculado neste curso</p>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-8">
            {/* Informações do curso */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{course.title}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">{course.description}</p>
              <div className="inline-block bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-medium">
                  <strong>Duração:</strong> {course.duration}
                </p>
              </div>
            </div>

            {/* Mensagem de status (sucesso/erro) */}
            {submitStatus === 'success' && (
              <div className="mb-6 p-4 bg-green-50 border-2 border-green-300 rounded-xl flex items-start gap-3">
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
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-900 mb-1">Erro ao enviar</h3>
                  <p className="text-sm text-red-800">
                    Ocorreu um erro. Por favor, tente novamente ou entre em contato diretamente.
                  </p>
                </div>
              </div>
            )}

            {/* Formulário de interesse */}
            {submitStatus !== 'success' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border-2 border-blue-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Demonstrar Interesse</h3>
                  <p className="text-gray-700 mb-6">
                    Preencha o formulário abaixo e entraremos em contato para informar sobre novas turmas ou organizar um curso in company.
                  </p>

                  {/* Tipo de interesse */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-900 mb-3">
                      Qual o seu interesse?
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 bg-white border-2 border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                        <input
                          type="radio"
                          name="interesse"
                          value="proxima-turma"
                          checked={formData.interesse === 'proxima-turma'}
                          onChange={(e) => setFormData({ ...formData, interesse: e.target.value })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div className="flex items-center gap-2">
                          <Mail className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-bold text-gray-900">Participar de uma próxima turma</p>
                            <p className="text-sm text-gray-600">Ser notificado quando houver nova turma</p>
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white border-2 border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                        <input
                          type="radio"
                          name="interesse"
                          value="in-company"
                          checked={formData.interesse === 'in-company'}
                          onChange={(e) => setFormData({ ...formData, interesse: e.target.value })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div className="flex items-center gap-2">
                          <Building className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="font-bold text-gray-900">Solicitar curso in company</p>
                            <p className="text-sm text-gray-600">Curso exclusivo para sua organização</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Mensagem adicional */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Mensagem adicional (opcional)
                    </label>
                    <textarea
                      value={formData.mensagem}
                      onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors resize-none"
                      placeholder="Compartilhe mais detalhes sobre seu interesse..."
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Interesse'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/area-restrita')}
                    className="px-6 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Informações de contato alternativas */}
            <div className="mt-8 p-6 bg-gray-50 border-2 border-gray-200 rounded-xl">
              <h3 className="font-bold text-gray-900 mb-3">Ou entre em contato diretamente:</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <strong>Email:</strong> contato@professorbarral.com.br
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <strong>WhatsApp:</strong> (XX) XXXXX-XXXX
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
