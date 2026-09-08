/**
 * Decide a profundidade da página de detalhe (spec §8.1).
 *
 * "Acesso ativo" é a regra canônica do site: matrícula válida OU assinatura
 * ativa (`hasAnyActiveAccess`), mais o admin. NÃO é "assinante" — um aluno
 * presencial com matrícula por QR code tem acesso sem nunca ter assinado, e
 * tratá-lo como visitante seria negar acesso a quem pagou pelo curso.
 */
import { getCurrentUser, hasAnyActiveAccess } from '@/lib/auth';

export async function resolverAcessoDoDetalhe(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return hasAnyActiveAccess(user.userId);
}
