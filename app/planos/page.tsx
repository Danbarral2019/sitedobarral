'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { courses } from '@/data/courses';

const COURSES = courses.map(c => ({ id: c.id, name: c.title }));

const PRICE_BASICO = process.env.NEXT_PUBLIC_PRICE_BASICO || '49,90';
const PRICE_PREMIUM = process.env.NEXT_PUBLIC_PRICE_PREMIUM || '89,90';

export default function PlanosPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]?.id || '2');
  const [loading, setLoading] = useState<'basico' | 'premium' | null>(null);
  const [error, setError] = useState('');

  const handleSubscribe = async (plan: 'basico' | 'premium') => {
    if (!user) {
      router.push(`/login?returnTo=/planos`);
      return;
    }

    setError('');
    setLoading(plan);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          ...(plan === 'basico' && { courseId: selectedCourse }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar checkout');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar. Tente novamente.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Planos de Assinatura
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Acesse os materiais de Direito Administrativo, Licitações e Contratos do Prof. Daniel Barral
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Cards de planos */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Plano Básico */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 flex flex-col">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Básico</h2>
              <p className="text-gray-500">Acesso a 1 curso específico</p>
              <div className="mt-6">
                <span className="text-5xl font-bold text-gray-900">R$ {PRICE_BASICO}</span>
                <span className="text-gray-500 text-lg">/mês</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Acesso completo a 1 curso</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Documentos, vídeos e materiais</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Atualizações contínuas</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Assistente IA com busca semântica</span>
              </li>
            </ul>

            {/* Seletor de curso */}
            <div className="mb-6">
              <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 mb-2">
                Escolha o curso:
              </label>
              <select
                id="course-select"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                {COURSES.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleSubscribe('basico')}
              disabled={loading !== null || isLoading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-xl transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading === 'basico' ? 'Redirecionando...' : 'Assinar Básico'}
            </button>
          </div>

          {/* Plano Premium */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 border-2 border-blue-500 relative flex flex-col">
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="inline-block px-5 py-1.5 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm shadow-md">
                RECOMENDADO
              </span>
            </div>

            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-white mb-2">Premium</h2>
              <p className="text-blue-100">Acesso completo a todos os cursos</p>
              <div className="mt-6">
                <span className="text-5xl font-bold text-white">R$ {PRICE_PREMIUM}</span>
                <span className="text-blue-200 text-lg">/mês</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Acesso a todos os {courses.length} cursos</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Documentos, vídeos e materiais</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Atualizações contínuas</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white font-semibold">Assistente IA com busca semântica</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white">Novos cursos inclusos automaticamente</span>
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('premium')}
              disabled={loading !== null || isLoading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-4 px-6 rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed shadow-lg"
            >
              {loading === 'premium' ? 'Redirecionando...' : 'Assinar Premium'}
            </button>
          </div>
        </div>

        {/* Info adicional */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            Perguntas Frequentes
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium text-gray-900 mb-1">Posso cancelar a qualquer momento?</p>
              <p className="text-gray-600">Sim, sem multa. O acesso permanece até o fim do período pago.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">Já participei de um curso presencial. O que muda?</p>
              <p className="text-gray-600">Seu QR Code dá 1 mês de acesso gratuito. Após, assine para continuar.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">Posso trocar de plano?</p>
              <p className="text-gray-600">Sim, a qualquer momento pelo portal de assinatura.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">O pagamento é seguro?</p>
              <p className="text-gray-600">Processado pelo Stripe, líder mundial em pagamentos online.</p>
            </div>
          </div>
        </div>

        {/* Voltar */}
        <div className="text-center">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
