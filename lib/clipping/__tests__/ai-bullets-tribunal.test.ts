// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldGenerateBulletsForTribunal } from '../ai-bullets';
import type { ClippingItem } from '../sources/types';

function makeItem(overrides: Partial<ClippingItem>): ClippingItem {
  return {
    sourceKind: 'tribunal-decision',
    sourceId: 'td-1',
    tribunalCode: 'TCE-PE',
    tribunalName: 'TCE-PE',
    decisionType: 'parecer',
    decisionNumber: '698/26',
    title: 't',
    dataJulgamento: null,
    relator: null,
    orgaoJulgador: null,
    ementa: 'e',
    fullText: null,
    linkExternal: null,
    linkPdf: null,
    relevanceScore: 80,
    publishedAt: new Date(),
    ...overrides,
  };
}

describe('shouldGenerateBulletsForTribunal', () => {
  it('false para TCU (passa por pipeline diferente)', () => {
    expect(
      shouldGenerateBulletsForTribunal(makeItem({ sourceKind: 'document-tcu', fullText: 'x'.repeat(2000) }))
    ).toBe(false);
  });

  it('false quando fullText é null (TCE-SP, STJ DataJud, etc.)', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: null }))).toBe(false);
  });

  it('false quando fullText < 800 chars (TCE-RS típico ~97 chars)', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'x'.repeat(500) }))).toBe(false);
  });

  it('true quando fullText >= 800 chars (TCE-PE)', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'x'.repeat(800) }))).toBe(true);
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'x'.repeat(5000) }))).toBe(true);
  });

  it('exatamente no threshold (800 chars) deve passar', () => {
    expect(shouldGenerateBulletsForTribunal(makeItem({ fullText: 'a'.repeat(800) }))).toBe(true);
  });
});

describe('generateAiBulletsForTribunal — gate por fullText', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"bullets":["Bullet teste primeiro item editorial razoavelmente longo para passar o filtro."]}' }] } }],
      }), { status: 200 }) as never
    );
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('retorna [] sem chamar Gemini quando fullText é curto', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    const result = await generateAiBulletsForTribunal(makeItem({ fullText: 'curto demais' }));
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('retorna [] sem chamar Gemini quando fullText é null', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    const result = await generateAiBulletsForTribunal(makeItem({ fullText: null }));
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('chama Gemini e retorna bullets quando fullText >= 800 chars', async () => {
    const { generateAiBulletsForTribunal } = await import('../ai-bullets');
    const result = await generateAiBulletsForTribunal(
      makeItem({ fullText: 'A '.repeat(500) }) // 1000 chars
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Bullet teste');
  });
});
