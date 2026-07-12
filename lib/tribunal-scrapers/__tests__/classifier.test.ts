// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { detectLeiArticles } from '../classifier';

describe('detectLeiArticles', () => {
  it('retorna o número puro do artigo, sem o prefixo "Art. " (formato canônico do índice)', () => {
    // O índice LEI_14133_ARTIGOS e os campos leiArticlesArr de Document/
    // LegislativeAct usam número puro ("75"). O classifier precisa gravar no
    // mesmo formato, senão o cruzamento decisão↔artigo quebra.
    expect(detectLeiArticles('nos termos do art. 75 da Lei 14.133')).toEqual(['75']);
  });

  it('preserva sufixo de letra (ex: 166-A) sem prefixo', () => {
    expect(detectLeiArticles('conforme o art. 166-A')).toEqual(['166-A']);
  });

  it('deduplica e ordena numericamente, tudo em número puro', () => {
    expect(detectLeiArticles('art. 75, artigo 6 e novamente Art. 75')).toEqual(['6', '75']);
  });
});
