import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/clipping/unsubscribe-token';
import { isAdminRecipientId } from '@/lib/clipping/recipients';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

async function processOptOut(token: string | undefined): Promise<{
  status: 'ok' | 'invalid' | 'already' | 'admin';
  email?: string;
}> {
  if (!token) return { status: 'invalid' };
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return { status: 'invalid' };

  if (isAdminRecipientId(userId)) {
    const email = userId.slice('admin:'.length);
    return { status: 'admin', email };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, clippingOptOut: true },
  });
  if (!user) return { status: 'invalid' };

  if (user.clippingOptOut) {
    return { status: 'already', email: user.email };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { clippingOptOut: true, clippingOptOutAt: new Date() },
  });

  return { status: 'ok', email: user.email };
}

export default async function ClippingCancelarPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const result = await processOptOut(token);

  const wrap = (heading: string, message: string, tone: 'success' | 'info' | 'error') => {
    const colors = {
      success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
      info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },
      error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    }[tone];
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 12, padding: '36px 32px', boxShadow: '0 1px 3px rgba(15,23,42,0.08)', borderLeft: `4px solid ${colors.border}` }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>Prof. Daniel Barral</p>
          <h1 style={{ margin: '6px 0 12px', fontSize: 22, color: '#0f172a' }}>{heading}</h1>
          <div style={{ background: colors.bg, padding: '14px 16px', borderRadius: 8, color: colors.text, fontSize: 14, lineHeight: 1.55 }}>{message}</div>
          <p style={{ margin: '18px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
            Esse cancelamento afeta apenas o <strong>clipping diário do TCU</strong>. Você continua recebendo a newsletter mensal e comunicações da plataforma.
          </p>
          <p style={{ margin: '18px 0 0', fontSize: 13 }}>
            <Link href="/" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>← Voltar para o site</Link>
          </p>
        </div>
      </div>
    );
  };

  if (result.status === 'invalid') {
    return wrap(
      'Link inválido ou expirado',
      'Não foi possível validar este link. Se você quer cancelar o clipping diário, escreva para contato@profdanielbarral.com que cancelamos manualmente.',
      'error',
    );
  }

  if (result.status === 'admin') {
    return wrap(
      'Conta administrativa',
      `${result.email ?? 'Este email'} está na lista de administradores do clipping (env CLIPPING_ADMIN_RECIPIENTS) e não pode ser cancelado por este link. Edite a variável de ambiente para remover.`,
      'info',
    );
  }

  if (result.status === 'already') {
    return wrap(
      'Você já estava cancelado',
      `O clipping diário já não é enviado para ${result.email}. Nada a fazer.`,
      'info',
    );
  }

  return wrap(
    'Clipping cancelado',
    `Pronto. ${result.email ? `Não enviaremos mais o clipping diário para ${result.email}.` : 'Não enviaremos mais o clipping diário para você.'} Se mudar de ideia, é só responder a qualquer email anterior pedindo pra reativar.`,
    'success',
  );
}
