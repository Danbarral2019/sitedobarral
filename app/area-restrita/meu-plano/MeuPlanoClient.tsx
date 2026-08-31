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
    past_due: { label: 'Pagamento pendente', className: 'bg-amber-accent-soft text-amber-accent-deep' },
    processing: { label: 'Em processamento', className: 'bg-brand-100 text-brand-800' },
    canceled: { label: 'Cancelada', className: 'bg-surface-deep text-ink-secondary' },
    unpaid: { label: 'Não paga', className: 'bg-red-100 text-red-800' },
    incomplete: { label: 'Incompleta', className: 'bg-surface-deep text-ink-secondary' },
  };
  return map[status] || { label: status, className: 'bg-surface-deep text-ink-secondary' };
}

export default function MeuPlanoClient({ subscription, enrollments }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
        <header className="mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-600 rounded-[6px] shrink-0">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-ink-primary">Meu plano</h1>
              <p className="text-ink-muted mt-1">
                Detalhes da sua assinatura e acessos ativos.
              </p>
            </div>
          </div>
        </header>

        {subscription ? (
          <section className="bg-white rounded-[6px] border border-border-subtle p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-ink-primary">
                    Plano {planLabel(subscription.plan)}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${statusBadge(subscription.status).className}`}
                  >
                    {statusBadge(subscription.status).label}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  Ciclo {billingLabel(subscription.billingCycle)}
                  {subscription.paymentMethod && ` · Pagamento via ${subscription.paymentMethod}`}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-raised rounded-[6px] p-4">
                <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wide font-semibold mb-1">
                  <Calendar className="w-3 h-3" /> Período atual
                </div>
                <p className="text-sm text-ink-primary">
                  {formatDate(subscription.currentPeriodStart)} até{' '}
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
              <div className="bg-surface-raised rounded-[6px] p-4">
                <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wide font-semibold mb-1">
                  {subscription.cancelAtPeriodEnd ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Renovação automática
                </div>
                <p className="text-sm text-ink-primary">
                  {subscription.cancelAtPeriodEnd
                    ? 'Cancelada — acesso ativo até o fim do período'
                    : 'Ativa — renova automaticamente'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/api/conta/portal"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white font-medium rounded-[6px] hover:bg-brand-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Gerenciar no Stripe
              </a>
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-subtle text-ink-secondary font-medium rounded-[6px] hover:bg-surface-raised transition-colors"
              >
                Ver outros planos
              </Link>
            </div>
            <p className="text-xs text-ink-muted mt-3">
              Alterações de cartão, cancelamento, recibos e faturas são feitos no portal seguro do Stripe.
            </p>
          </section>
        ) : (
          <section className="bg-brand-50 border border-amber-accent-soft rounded-[6px] p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-[6px] shrink-0">
                <Sparkles className="w-6 h-6 text-amber-accent-deep" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-ink-primary mb-1">
                  Você ainda não tem uma assinatura ativa
                </h2>
                <p className="text-ink-secondary text-sm mb-4">
                  Para ter acesso completo a cursos, assistente IA e jurisprudência com IA, escolha
                  um plano.
                </p>
                <Link
                  href="/planos"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white font-medium rounded-[6px] hover:bg-brand-700 transition-colors"
                >
                  Ver planos disponíveis
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white rounded-[6px] border border-border-subtle p-6">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-ink-primary">Meus cursos ativos</h2>
          </div>
          {enrollments.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nenhuma matrícula ativa no momento.
            </p>
          ) : (
            <ul className="space-y-2">
              {enrollments.map(e => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[6px] border border-border-subtle hover:border-border-strong hover:bg-surface-raised transition-colors"
                >
                  <div>
                    <p className="font-medium text-ink-primary text-sm">Curso #{e.courseId}</p>
                    <p className="text-xs text-ink-muted">
                      {e.isLifetime
                        ? 'Acesso vitalício'
                        : e.expiresAt
                        ? `Expira em ${formatDate(e.expiresAt)}`
                        : 'Sem data de expiração'}
                    </p>
                  </div>
                  <span className="text-xs text-ink-muted">
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
