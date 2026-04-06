'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { courses } from '@/data/courses';

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

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  paymentId: number;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5 text-green-500 mt-0.5 flex-shrink-0'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixPlan, setPixPlan] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isYearly = billingCycle === 'yearly';

  const handleSubscribe = async (plan: 'basico' | 'premium') => {
    if (!user) {
      router.push(`/registro?returnTo=/planos`);
      return;
    }

    setError('');
    setLoading(plan);
    setPixData(null);

    try {
      const payload = {
        plan,
        billingCycle,
        ...(plan === 'basico' && { courseId: selectedCourse }),
      };

      if (paymentMethod === 'pix') {
        const response = await fetch('/api/pagamento/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao gerar PIX');
        }

        setPixData(data);
        setPixPlan(plan);
        setLoading(null);
      } else {
        const response = await fetch('/api/pagamento/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao iniciar checkout');
        }

        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar. Tente novamente.');
      setLoading(null);
    }
  };

  const copyPixCode = async () => {
    if (!pixData?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = pixData.qrCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-16 px-4 sm:px-6 lg:px-8">
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
          </div>
        )}

        {/* Toggle Mensal / Anual */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => { setBillingCycle('monthly'); setPixData(null); }}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !isYearly
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => { setBillingCycle('yearly'); setPixData(null); }}
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

        {/* Seletor de método de pagamento */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => { setPaymentMethod('cartao'); setPixData(null); }}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                paymentMethod === 'cartao'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cartão / Boleto
            </button>
            <button
              onClick={() => { setPaymentMethod('pix'); setPixData(null); }}
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

        {/* QR Code PIX inline */}
        {pixData && (
          <div className="mb-8 max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 border border-green-200">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Pagamento PIX - Plano {pixPlan === 'premium' ? 'Premium' : 'Básico'}{' '}
                {isYearly ? 'Anual' : 'Mensal'}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Escaneie o QR Code ou copie o código para pagar
              </p>

              {pixData.qrCodeBase64 && (
                <div className="mb-6 flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {pixData.qrCode && (
                <div className="mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500 font-mono break-all leading-relaxed">
                      {pixData.qrCode.slice(0, 80)}...
                    </p>
                  </div>
                  <button
                    onClick={copyPixCode}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-4">
                Após o pagamento, seu acesso será liberado automaticamente em até 5 minutos.
              </p>
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
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 border-2 border-blue-500 relative flex flex-col">
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
                <span className="text-blue-200 text-lg">
                  {isYearly ? '/ano' : '/mês'}
                </span>
              </div>
              {isYearly && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-blue-300 line-through">
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
              <p className="text-gray-600">PIX (aprovação instantânea), cartão de crédito e boleto bancário, via Mercado Pago.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">O pagamento é seguro?</p>
              <p className="text-gray-600">Processado pelo Mercado Pago, plataforma líder em pagamentos no Brasil.</p>
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
