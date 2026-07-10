import { describe, it, expect, vi } from 'vitest';

const afterMock = vi.fn();
vi.mock('next/server', () => ({ after: (...args: unknown[]) => afterMock(...args) }));

import { runAfterResponse } from '../after-response';

describe('runAfterResponse', () => {
  it('agenda a promise via after() do next/server', () => {
    afterMock.mockReset().mockImplementation(() => {});
    const p = Promise.resolve();

    runAfterResponse(p);

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(afterMock).toHaveBeenCalledWith(p);
  });

  it('não lança quando after() lança (fora de escopo de request, ex.: testes)', () => {
    afterMock.mockReset().mockImplementation(() => {
      throw new Error('after() called outside a request scope');
    });
    const p = Promise.resolve();

    expect(() => runAfterResponse(p)).not.toThrow();
  });
});
