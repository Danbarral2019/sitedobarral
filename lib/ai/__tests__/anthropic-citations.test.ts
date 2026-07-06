import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { extractCitations } from '../providers/anthropic';

/** Constrói um ContentBlock[] mínimo com citações char_location. */
function content(blocks: unknown[]): Anthropic.ContentBlock[] {
  return blocks as unknown as Anthropic.ContentBlock[];
}

describe('extractCitations', () => {
  it('extrai citações char_location dos blocos de texto', () => {
    const c = content([
      {
        type: 'text',
        text: 'Conforme o Art. 75, a dispensa é possível.',
        citations: [
          {
            type: 'char_location',
            cited_text: 'É dispensável a licitação para contratação que envolva valores inferiores',
            document_index: 2,
            document_title: 'Lei 14.133/2021 — Art. 75',
            start_char_index: 10,
            end_char_index: 82,
          },
        ],
      },
    ]);
    const out = extractCitations(c);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      citedText: 'É dispensável a licitação para contratação que envolva valores inferiores',
      documentIndex: 2,
      documentTitle: 'Lei 14.133/2021 — Art. 75',
      startCharIndex: 10,
      endCharIndex: 82,
    });
  });

  it('ignora blocos de texto sem citações e blocos não-texto', () => {
    const c = content([
      { type: 'text', text: 'sem citação', citations: null },
      { type: 'thinking', thinking: 'x' },
      {
        type: 'text',
        text: 'com citação',
        citations: [
          { type: 'char_location', cited_text: 'trecho', document_index: 0, document_title: null, start_char_index: 0, end_char_index: 6 },
        ],
      },
    ]);
    const out = extractCitations(c);
    expect(out).toHaveLength(1);
    expect(out[0].documentIndex).toBe(0);
    expect(out[0].documentTitle).toBeUndefined();
  });

  it('retorna vazio quando não há citações', () => {
    expect(extractCitations(content([{ type: 'text', text: 'nada', citations: null }]))).toEqual([]);
  });
});
