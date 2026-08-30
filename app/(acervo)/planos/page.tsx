'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { courses } from '@/data/courses';
import { PIX_ENABLED } from '@/lib/payments/config';

const COURSES = courses.map(c => ({ id: c.id, name: c.title }));

const PRICE_BASICO = process.env.NEXT_PUBLIC_PRICE_BASICO || '49,90';
const PRICE_PREMIUM = process.env.NEXT_PUBLIC_PRICE_PREMIUM || '89,90';
const PRICE_BASICO_ANUAL = process.env.NEXT_PUBLIC_PRICE_BASICO_ANUAL || '499,00';
const PRICE_PREMIUM_ANUAL = process.env.NEXT_PUBLIC_PRICE_PREMIUM_ANUAL || '899,00';

// Economia calculada: 12 meses mensal - preco anual
const ECONOMIA_BASICO = ((49.90 * 12) - 499.00).toFixed(2).replace('.', ',');
const ECONOMIA_PREMIUM = ((89.90 * 12) - 899.00).toFixed(2).replace('.', ',');

type PaymentMethod = 'cartao' | 'pix';
type BillingCycle = 'monthly' | 'yearly';

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5 text-ink-secondary mt-0.5 flex-shrink-0'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PlanosPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]?.id || '2');
  const [loading, setLoading] = useState<'basico' | 'premium' | null>(null);
  const [error, setError] = useState('');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const isYearly = billingCycle === 'yearly';

  const handleSubscribe = async (plan: 'basico' | 'premium') => {
    if (!user) {
      router.push(`/registro?returnTo=/planos`);
      return;
    }

    setError('');
    setHasActiveSubscription(false);
    setLoading(plan);

    try {
      const payload = {
        plan,
        billingCycle,
        method: paymentMethod === 'cartao' ? 'card' : 'pix',
        ...(plan === 'basico' && { courseId: selectedCourse }),
      };

      const response = await fetch('/api/pagamento/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setHasActiveSubscription(true);
        }
        throw new Error(data.error || 'Erro ao iniciar checkout');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar. Tente novamente.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-raised py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
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
            {hasActiveSubscription && (
              <a
                href="/api/conta/portal"
                className="inline-block mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Gerenciar assinatura
              </a>
            )}
          </div>
        )}

        {/* Toggle Mensal / Anual */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => { setBillingCycle('monthly');}}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !isYearly
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => { setBillingCycle('yearly');}}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isYearly
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Anual
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isYearly
                  ? 'bg-yellow-400 text-yellow-900'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                2 meses grátis
              </span>
            </button>
          </div>
        </div>

        {/* Seletor de método de pagamento — só aparece quando há mais de uma opção.
            PIX (Pix Automático) está desabilitado até a Stripe liberar — ver lib/payments/config.ts. */}
        {PIX_ENABLED && (
          <div className="mb-8 flex justify-center">
            <div className="inline-flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
              <button
                onClick={() => { setPaymentMethod('cartao');}}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  paymentMethod === 'cartao'
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Cartão / Boleto
              </button>
              <button
                onClick={() => { setPaymentMethod('pix');}}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  paymentMethod === 'pix'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                PIX
              </button>
            </div>
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
                <span className="text-5xl font-bold text-gray-900">
                  R$ {isYearly ? PRICE_BASICO_ANUAL : PRICE_BASICO}
                </span>
                <span className="text-gray-500 text-lg">
                  {isYearly ? '/ano' : '/mês'}
                </span>
              </div>
              {isYearly && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-gray-400 line-through">
                    R$ {(49.90 * 12).toFixed(2).replace('.', ',')}/ano no plano mensal
                  </p>
                  <span className="inline-block bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                    Economize R$ {ECONOMIA_BASICO}
                  </span>
                </div>
              )}
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Acesso completo a 1 curso</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Documentos, vídeos e materiais</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Atualizações contínuas</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
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
              {loading === 'basico'
                ? (paymentMethod === 'pix' ? 'Gerando PIX...' : 'Redirecionando...')
                : `Assinar Básico ${isYearly ? 'Anual' : ''}${paymentMethod === 'pix' ? ' com PIX' : ''}`}
            </button>
          </div>

          {/* Plano Premium */}
          <div className="bg-surface-raised rounded-2xl shadow-xl p-8 border-2 border-blue-500 relative flex flex-col">
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="inline-block px-5 py-1.5 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm shadow-md">
                {isYearly ? 'MELHOR VALOR' : 'RECOMENDADO'}
              </span>
            </div>

            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-white mb-2">Premium</h2>
              <p className="text-blue-100">Acesso completo a todos os cursos</p>
              <div className="mt-6">
                <span className="text-5xl font-bold text-white">
                  R$ {isYearly ? PRICE_PREMIUM_ANUAL : PRICE_PREMIUM}
                </span>
                <span className="text-ink-muted text-lg">
                  {isYearly ? '/ano' : '/mês'}
                </span>
              </div>
              {isYearly && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-ink-muted line-through">
                    R$ {(89.90 * 12).toFixed(2).replace('.', ',')}/ano no plano mensal
                  </p>
                  <span className="inline-block bg-white/20 text-white text-sm font-semibold px-3 py-1 rounded-full">
                    Economize R$ {ECONOMIA_PREMIUM}
                  </span>
                </div>
              )}
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-white">Acesso a todos os {courses.length} cursos</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-white">Documentos, vídeos e materiais</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-white">Atualizações contínuas</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-white font-semibold">Assistente IA com busca semântica</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-white">Novos cursos inclusos automaticamente</span>
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('premium')}
              disabled={loading !== null || isLoading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-4 px-6 rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed shadow-lg"
            >
              {loading === 'premium'
                ? (paymentMethod === 'pix' ? 'Gerando PIX...' : 'Redirecionando...')
                : `Assinar Premium ${isYearly ? 'Anual' : ''}${paymentMethod === 'pix' ? ' com PIX' : ''}`}
            </button>
          </div>
        </div>

        {/* Equivalência mensal para plano anual */}
        {isYearly && (
          <div className="text-center mb-12 -mt-8">
            <p className="text-sm text-gray-500">
              Plano anual equivale a{' '}
              <span className="font-semibold text-gray-700">R$ {(499 / 12).toFixed(2).replace('.', ',')}/mês</span> (Básico) ou{' '}
              <span className="font-semibold text-gray-700">R$ {(899 / 12).toFixed(2).replace('.', ',')}/mês</span> (Premium)
            </p>
          </div>
        )}

        {/* FAQ */}
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
              <p className="font-medium text-gray-900 mb-1">Quais formas de pagamento?</p>
              <p className="text-gray-600">{PIX_ENABLED ? 'Cartão de crédito e Pix Automático (débito recorrente autorizado no app do seu banco).' : 'Cartão de crédito e boleto bancário.'}</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">O pagamento é seguro?</p>
              <p className="text-gray-600">Processado pelo Stripe, plataforma líder em pagamentos no mundo, com criptografia de ponta a ponta.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">Qual a vantagem do plano anual?</p>
              <p className="text-gray-600">Você paga o equivalente a 10 meses e ganha 2 meses grátis de acesso.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">Posso trocar de plano?</p>
              <p className="text-gray-600">Sim. Cancele o plano atual e assine o novo. O acesso anterior permanece até o fim do período.</p>
            </div>
          </div>
        </div>

        {/* Login / Voltar */}
        <div className="text-center space-y-3">
          {!user && (
            <p className="text-sm text-gray-600">
              Já tem conta?{' '}
              <Link
                href="/login?returnTo=/planos"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Fazer login
              </Link>
            </p>
          )}
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
