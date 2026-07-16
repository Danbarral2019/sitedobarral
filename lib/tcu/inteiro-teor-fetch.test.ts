import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchInteiroTeor, TETO_BYTES } from './inteiro-teor-fetch';

const RTF = Buffer.from('{\\rtf1 ok}', 'latin1');

function mockFetch(body: Buffer, init?: { status?: number; headers?: Record<string, string> }) {
  return vi.fn().mockResolvedValue({
    ok: (init?.status ?? 200) < 400,
    status: init?.status ?? 200,
    headers: { get: (h: string) => (init?.headers ?? {})[h.toLowerCase()] ?? null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

describe('fetchInteiroTeor', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('baixa e devolve o buffer', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.buf.toString()).toContain('rtf1');
  });

  it('identifica-se com User-Agent do projeto', async () => {
    const f = mockFetch(RTF);
    vi.stubGlobal('fetch', f);
    await fetchInteiroTeor('https://x/y');
    expect(f.mock.calls[0][1].headers['User-Agent']).toContain('SiteDoBarral');
  });

  it('recusa HTTP de erro sem lançar', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF, { status: 404 }));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r).toEqual({ ok: false, erro: 'HTTP 404' });
  });

  it('recusa quem passa do teto ANTES de baixar (content-length): não chega a consumir o corpo', async () => {
    const arrayBufferSpy = vi.fn(async () =>
      RTF.buffer.slice(RTF.byteOffset, RTF.byteOffset + RTF.byteLength)
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h.toLowerCase() === 'content-length' ? String(TETO_BYTES + 1) : null) },
        arrayBuffer: arrayBufferSpy,
      })
    );
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('excede o teto');
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('pina o teto em 20 MB — acórdãos reais chegam a 14,5 MB', () => {
    expect(TETO_BYTES).toBe(20 * 1024 * 1024);
  });

  it('recusa quem passa do teto sem declarar content-length', async () => {
    const grande = Buffer.alloc(1024);
    vi.stubGlobal('fetch', mockFetch(grande));
    const r = await fetchInteiroTeor('https://x/y', { tetoBytes: 512 });
    expect(r.ok).toBe(false);
  });

  it('recusa o que não é RTF (magic bytes)', async () => {
    vi.stubGlobal('fetch', mockFetch(Buffer.from('<html>erro</html>')));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('não é RTF');
  });

  it('devolve erro em vez de estourar quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('ECONNRESET');
  });
});
