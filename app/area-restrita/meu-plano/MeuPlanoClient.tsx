'use client';

import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Calendar,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface SubscriptionData {
  id: string;
  plan: string;
  billingCycle: string | null;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod: string | null;
  courseId: string | null;
}

interface EnrollmentData {
  id: string;
  courseId: string;
  expiresAt: string | null;
  isLifetime: boolean;
  enrolledAt: string;
}

interface Props {
  subscription: SubscriptionData | null;
  enrollments: EnrollmentData[];
}

function formatDate(iso: string | null): string {
  if (!iso) return 'n/d';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function planLabel(plan: string): string {
  const map: Record<string, string> = {
    basico: 'Básico',
    premium: 'Premium',
  };
  return map[plan] || plan;
}

function billingLabel(cycle: string | null): string {
  if (cycle === 'monthly') return 'Mensal';
  if (cycle === 'yearly') return 'Anual';
  return 'n/d';
}

function statusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Ativa', className: 'bg-emerald-100 text-emerald-800' },
    past_due: { label: 'Pagamento pendente', className: 'bg-amber-100 text-amber-800' },
    processing: { label: 'Em processamento', className: 'bg-blue-100 text-blue-800' },
    canceled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-700' },
    unpaid: { label: 'Não paga', className: 'bg-red-100 text-red-800' },
    incomplete: { label: 'Incompleta', className: 'bg-gray-100 text-gray-700' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
}

export default function MeuPlanoClient({ subscription, enrollments }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
        <header className="mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shrink-0">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Meu plano</h1>
              <p className="text-gray-600 mt-1">
                Detalhes da sua assinatura e acessos ativos.
              </p>
            </div>
          </div>
        </header>

        {subscription ? (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    Plano {planLabel(subscription.plan)}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${statusBadge(subscription.status).className}`}
                  >
                    {statusBadge(subscription.status).label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Ciclo {billingLabel(subscription.billingCycle)}
                  {subscription.paymentMethod && ` · Pagamento via ${subscription.paymentMethod}`}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
                  <Calendar className="w-3 h-3" /> Período atual
                </div>
                <p className="text-sm text-gray-900">
                  {formatDate(subscription.currentPeriodStart)} até{' '}
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
                  {subscription.cancelAtPeriodEnd ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Renovação automática
                </div>
                <p className="text-sm text-gray-900">
                  {subscription.cancelAtPeriodEnd
                    ? 'Cancelada — acesso ativo até o fim do período'
                    : 'Ativa — renova automaticamente'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/api/conta/portal"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Gerenciar no Stripe
              </a>
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Ver outros planos
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Alterações de cartão, cancelamento, recibos e faturas são feitos no portal seguro do Stripe.
            </p>
          </section>
        ) : (
          <section className="bg-gradient-to-br from-amber-50 to-blue-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg shrink-0">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Você ainda não tem uma assinatura ativa
                </h2>
                <p className="text-gray-700 text-sm mb-4">
                  Para ter acesso completo a cursos, assistente IA e jurisprudência com IA, escolha
                  um plano.
                </p>
                <Link
                  href="/planos"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ver planos disponíveis
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Meus cursos ativos</h2>
          </div>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma matrícula ativa no momento.
            </p>
          ) : (
            <ul className="space-y-2">
              {enrollments.map(e => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Curso #{e.courseId}</p>
                    <p className="text-xs text-gray-500">
                      {e.isLifetime
                        ? 'Acesso vitalício'
                        : e.expiresAt
                        ? `Expira em ${formatDate(e.expiresAt)}`
                        : 'Sem data de expiração'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    Matriculado em {formatDate(e.enrolledAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
