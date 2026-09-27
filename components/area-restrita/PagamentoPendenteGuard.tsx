'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getPendingSubscription } from '@/lib/enrollment-utils';

const ROTA_PENDENTE = '/area-restrita/pagamento-pendente';

/**
 * Com a cobrança da assinatura recusada, o acesso aos cursos do plano fica
 * suspenso até a regularização. Em vez de a área restrita aparecer vazia, sem
 * explicação, o aluno é levado à tela que diz o motivo e o caminho para
 * regularizar.
 */
export function PagamentoPendenteGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const bloqueado =
    user?.role === 'student' && !!getPendingSubscription(user.subscriptions) && pathname !== ROTA_PENDENTE;

  useEffect(() => {
    if (bloqueado) router.replace(ROTA_PENDENTE);
  }, [bloqueado, router]);

  if (bloqueado) return null;
  return <>{children}</>;
}
