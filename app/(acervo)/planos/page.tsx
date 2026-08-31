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
    <svg className={className || 'w-5 h-5 text-green-500 mt-0.5 flex-shrink-0'} fill="none"stroke="currentColor"viewBox="0 0 24 24">
      <path strokeLinecap="round"strokeLinejoin="round"strokeWidth={2} d="M5 13l4 4L19 7" />
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
    <div className="min-h-screen bg-brand-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-ink-primary mb-4">
            Planos de Assinatura
          </h1>
          <p className="text-xl text-ink-muted max-w-2xl mx-auto">
            Acesse os materiais de Direito Administrativo, Licitações e Contratos do Prof. Daniel Barral
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-[6px] text-center">
            <p className="text-sm text-red-600">{error}</p>
            {hasActiveSubscription && (
              <a
                href="/api/conta/portal"
                className="inline-block mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-[6px] transition-colors"
              >
                Gerenciar assinatura
              </a>
            )}
          </div>
        )}

        {/* Toggle Mensal / Anual */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex bg-white rounded-[6px] border border-border-subtle p-1">
            <button
              onClick={() => { setBillingCycle('monthly');}}
              className={`px-6 py-2.5 rounded-[6px] text-sm font-medium transition-colors ${
                !isYearly
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => { setBillingCycle('yearly');}}
              className={`px-6 py-2.5 rounded-[6px] text-sm font-medium transition-colors flex items-center gap-2 ${
                isYearly
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Anual
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isYearly
                  ? 'bg-amber-accent text-amber-accent-deep'
                  : 'bg-amber-accent-soft text-amber-accent-deep'
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
            <div className="inline-flex bg-white rounded-[6px] border border-border-subtle p-1">
              <button
                onClick={() => { setPaymentMethod('cartao');}}
                className={`px-6 py-2.5 rounded-[6px] text-sm font-medium transition-colors ${
                  paymentMethod === 'cartao'
                    ? 'bg-brand-900 text-white'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Cartão / Boleto
              </button>
              <button
                onClick={() => { setPaymentMethod('pix');}}
                className={`px-6 py-2.5 rounded-[6px] text-sm font-medium transition-colors ${
                  paymentMethod === 'pix'
                    ? 'bg-green-600 text-white'
                    : 'text-ink-muted hover:text-ink-primary'
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
          <div className="bg-white rounded-[6px] p-8 border border-border-subtle flex flex-col">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Básico</h2>
              <p className="text-ink-muted">Acesso a 1 curso específico</p>
              <div className="mt-6">
                <span className="text-5xl font-bold text-ink-primary">
                  R$ {isYearly ? PRICE_BASICO_ANUAL : PRICE_BASICO}
                </span>
                <span className="text-ink-muted text-lg">
                  {isYearly ? '/ano' : '/mês'}
                </span>
              </div>
              {isYearly && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-ink-muted line-through">
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
                <span className="text-ink-secondary">Acesso completo a 1 curso</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-ink-secondary">Documentos, vídeos e materiais</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-ink-secondary">Atualizações contínuas</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-ink-secondary">Assistente IA com busca semântica</span>
              </li>
            </ul>

            {/* Seletor de curso */}
            <div className="mb-6">
              <label htmlFor="course-select"className="block text-sm font-medium text-ink-secondary mb-2">
                Escolha o curso:
              </label>
              <select
                id="course-select"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full rounded-[6px] border border-border-subtle px-4 py-3 text-ink-primary focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
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
              className="w-full bg-brand-900 hover:bg-brand-950 text-white font-semibold py-4 px-6 rounded-[6px] transition-colors disabled:bg-border-strong disabled:cursor-not-allowed"
            >
              {loading === 'basico'
                ? (paymentMethod === 'pix' ? 'Gerando PIX...' : 'Redirecionando...')
                : `Assinar Básico ${isYearly ? 'Anual' : ''}${paymentMethod === 'pix' ? 'com PIX' : ''}`}
            </button>
          </div>

          {/* Plano Premium */}
          <div className="bg-brand-600 rounded-[6px] p-8 border-2 border-brand-500 relative flex flex-col">
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="inline-block px-5 py-1.5 bg-amber-accent text-ink-primary rounded-full font-bold text-sm border border-border-subtle">
                {isYearly ? 'MELHOR VALOR' : 'RECOMENDADO'}
              </span>
            </div>

            <div className="text-center mb-8 mt-4">
              <h2 className="text-2xl font-bold text-white mb-2">Premium</h2>
              <p className="text-brand-100">Acesso completo a todos os cursos</p>
              <div className="mt-6">
                <span className="text-5xl font-bold text-white">
                  R$ {isYearly ? PRICE_PREMIUM_ANUAL : PRICE_PREMIUM}
                </span>
                <span className="text-brand-200 text-lg">
                  {isYearly ? '/ano' : '/mês'}
                </span>
              </div>
              {isYearly && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-brand-300 line-through">
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
              className="w-full bg-amber-accent hover:bg-amber-accent-deep text-ink-primary font-bold py-4 px-6 rounded-[6px] transition-colors disabled:bg-border-strong disabled:text-ink-muted disabled:cursor-not-allowed"
            >
              {loading === 'premium'
                ? (paymentMethod === 'pix' ? 'Gerando PIX...' : 'Redirecionando...')
                : `Assinar Premium ${isYearly ? 'Anual' : ''}${paymentMethod === 'pix' ? 'com PIX' : ''}`}
            </button>
          </div>
        </div>

        {/* Equivalência mensal para plano anual */}
        {isYearly && (
          <div className="text-center mb-12 -mt-8">
            <p className="text-sm text-ink-muted">
              Plano anual equivale a{' '}
              <span className="font-semibold text-ink-secondary">R$ {(499 / 12).toFixed(2).replace('.', ',')}/mês</span> (Básico) ou{' '}
              <span className="font-semibold text-ink-secondary">R$ {(899 / 12).toFixed(2).replace('.', ',')}/mês</span> (Premium)
            </p>
          </div>
        )}

        {/* FAQ */}
        <div className="bg-white rounded-[6px] border border-border-subtle p-8 mb-8">
          <h3 className="text-lg font-semibold text-ink-primary mb-4 text-center">
            Perguntas Frequentes
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium text-ink-primary mb-1">Posso cancelar a qualquer momento?</p>
              <p className="text-ink-muted">Sim, sem multa. O acesso permanece até o fim do período pago.</p>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Já participei de um curso presencial. O que muda?</p>
              <p className="text-ink-muted">Seu QR Code dá 1 mês de acesso gratuito. Após, assine para continuar.</p>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Quais formas de pagamento?</p>
              <p className="text-ink-muted">{PIX_ENABLED ? 'Cartão de crédito e Pix Automático (débito recorrente autorizado no app do seu banco).' : 'Cartão de crédito e boleto bancário.'}</p>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">O pagamento é seguro?</p>
              <p className="text-ink-muted">Processado pelo Stripe, plataforma líder em pagamentos no mundo, com criptografia de ponta a ponta.</p>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Qual a vantagem do plano anual?</p>
              <p className="text-ink-muted">Você paga o equivalente a 10 meses e ganha 2 meses grátis de acesso.</p>
            </div>
            <div>
              <p className="font-medium text-ink-primary mb-1">Posso trocar de plano?</p>
              <p className="text-ink-muted">Sim. Cancele o plano atual e assine o novo. O acesso anterior permanece até o fim do período.</p>
            </div>
          </div>
        </div>

        {/* Login / Voltar */}
        <div className="text-center space-y-3">
          {!user && (
            <p className="text-sm text-ink-muted">
              Já tem conta?{' '}
              <Link
                href="/login?returnTo=/planos"
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Fazer login
              </Link>
            </p>
          )}
          <Link
            href="/"
            className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
          >
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
