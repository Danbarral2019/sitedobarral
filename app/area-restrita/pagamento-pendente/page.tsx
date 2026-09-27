import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertTriangle, CreditCard, RefreshCw } from 'lucide-react';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Pagamento pendente',
  description: 'Regularize o pagamento da sua assinatura para reativar o acesso.',
};

const PLANOS: Record<string, string> = { basico: 'Básico', premium: 'Premium' };

/**
 * Tela exibida quando a cobrança da assinatura foi recusada
 * (invoice.payment_failed). O acesso aos cursos do plano fica suspenso até a
 * regularização; o PagamentoPendenteGuard da área restrita encaminha para cá.
 */
export default async function PagamentoPendentePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) redirect('/login');

  const payload = await verifyToken(token);
  if (!payload) redirect('/login');

  const [pendente, ativa] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId: payload.userId, status: 'past_due' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true, paymentMethod: true },
    }),
    prisma.subscription.findFirst({
      where: { userId: payload.userId, status: 'active' },
      select: { id: true },
    }),
  ]);

  // Sem pendência (ou já regularizada): nada a mostrar aqui.
  if (!pendente || ativa) redirect('/area-restrita');

  const plano = PLANOS[pendente.plan] ?? pendente.plan;
  const viaPix = pendente.paymentMethod === 'pix';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-10 lg:py-16">
        <div className="border border-border-subtle rounded-[6px] p-6 lg:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-amber-accent-soft rounded-[6px] shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-accent-deep" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink-primary mb-1">Pagamento não aprovado</h1>
              <p className="text-ink-muted">Assinatura do plano {plano}</p>
            </div>
          </div>

          <div className="space-y-4 text-ink-secondary">
            <p>
              A última cobrança da sua assinatura não foi autorizada
              {viaPix ? ', porque a autorização recorrente de Pix expirou ou foi cancelada' : ''}.
              Por isso, o acesso aos cursos do plano está <strong>suspenso</strong>.
            </p>
            <p>
              Para regularizar, {viaPix ? 'renove a autorização de Pix ou escolha' : 'atualize os dados do cartão ou escolha'}{' '}
              outro meio de pagamento no portal de cobrança. Assim que o pagamento for aprovado, o acesso é
              reativado automaticamente, em poucos minutos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <a
              href="/api/conta/portal"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white font-medium rounded-[6px] hover:bg-brand-700 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Regularizar pagamento
            </a>
            <Link
              href="/area-restrita/pagamento-pendente"
              prefetch={false}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-subtle text-ink-secondary font-medium rounded-[6px] hover:bg-surface-raised transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Já regularizei
            </Link>
          </div>

          <p className="text-sm text-ink-muted mt-6">
            Dúvidas sobre a cobrança? Fale conosco pela{' '}
            <Link href="/contato" className="text-brand-600 hover:text-brand-700 font-medium">
              página de contato
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
