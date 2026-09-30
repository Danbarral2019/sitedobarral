import * as Sentry from '@sentry/nextjs';

/**
 * Áreas cujos erros tratados localmente (capturados, registrados em log e
 * respondidos sem relançar) precisam chegar ao Sentry: sem isso, uma falha de
 * pagamento, de login ou do assistente só aparece no log da Vercel, que
 * ninguém lê a tempo. O `handleApiError` já reporta o que chega até ele.
 */
export type AreaMonitorada = 'pagamento' | 'auth' | 'assistente';

/**
 * Envia ao Sentry um erro já tratado, com a área como tag para filtrar e
 * alertar. `detalhes` leva só identificadores (ids, tipo de evento); nunca
 * e-mail, senha, token ou texto do usuário.
 */
export function reportError(
  erro: unknown,
  area: AreaMonitorada,
  detalhes?: Record<string, string | number | boolean | null | undefined>,
): void {
  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    if (detalhes) scope.setContext('detalhes', detalhes);
    Sentry.captureException(erro instanceof Error ? erro : new Error(String(erro)));
  });
}

/** Como `reportError`, para situações sem exceção (configuração ausente, evento de negócio grave). */
export function reportMessage(
  mensagem: string,
  area: AreaMonitorada,
  detalhes?: Record<string, string | number | boolean | null | undefined>,
): void {
  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    if (detalhes) scope.setContext('detalhes', detalhes);
    Sentry.captureMessage(mensagem, 'error');
  });
}
