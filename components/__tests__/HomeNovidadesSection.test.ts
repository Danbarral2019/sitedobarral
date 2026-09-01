import { describe, expect, it } from 'vitest';
import { markdownToPlainExcerpt } from '@/components/HomeNovidadesSection';

describe('markdownToPlainExcerpt', () => {
  it('remove marcações de heading, link, ênfase e bloco de citação', () => {
    const markdown = '## Resumo\n> **Decisão** com [fonte oficial](https://example.com) e `referência`.';

    expect(markdownToPlainExcerpt(markdown)).toBe(
      'Resumo Decisão com fonte oficial e referência.',
    );
  });

  it('normaliza espaços antes da apresentação', () => {
    expect(markdownToPlainExcerpt('Texto\n\n  com   espaços')).toBe('Texto com espaços');
  });
});
