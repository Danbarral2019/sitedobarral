import { describe, it, expect, vi, beforeEach } from 'vitest';

const scope = { setTag: vi.fn(), setContext: vi.fn() };
const captureException = vi.fn();
const captureMessage = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  withScope: (cb: (s: typeof scope) => void) => cb(scope),
  captureException: (...a: unknown[]) => captureException(...a),
  captureMessage: (...a: unknown[]) => captureMessage(...a),
}));

import { reportError, reportMessage } from '../report-error';

describe('reportError', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marca a área e anexa os detalhes', () => {
    const err = new Error('falhou');
    reportError(err, 'pagamento', { eventId: 'evt_1' });
    expect(scope.setTag).toHaveBeenCalledWith('area', 'pagamento');
    expect(scope.setContext).toHaveBeenCalledWith('detalhes', { eventId: 'evt_1' });
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it('embrulha em Error o que não é Error', () => {
    reportError('texto solto', 'auth');
    const enviado = captureException.mock.calls[0][0];
    expect(enviado).toBeInstanceOf(Error);
    expect((enviado as Error).message).toBe('texto solto');
    expect(scope.setContext).not.toHaveBeenCalled();
  });

  it('reportMessage envia mensagem com nível error', () => {
    reportMessage('segredo ausente', 'pagamento');
    expect(scope.setTag).toHaveBeenCalledWith('area', 'pagamento');
    expect(captureMessage).toHaveBeenCalledWith('segredo ausente', 'error');
  });
});
