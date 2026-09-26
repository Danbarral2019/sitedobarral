/**
 * Trava: `Document.textoIntegral` (inteiro teor dos pareceres da AGU, PDF do
 * DECOR) é para LEITURA na página e NÃO entra no retrieval.
 *
 * Pôr dezenas de milhares de chars de parecer no índice muda o ranking de
 * toda a busca; isso só pode acontecer depois de medido no eval
 * (`npm run eval:run`), numa mudança deliberada — não por acidente de alguém
 * que acrescente o campo ao texto-fonte. Se for para indexar, apague este
 * teste junto com a medição que o justifica.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { selectSourceText } from '../source-text';

describe('textoIntegral fora do texto-fonte do embedding', () => {
  it('selectSourceText ignora textoIntegral', () => {
    const doc = { textoIntegral: 'Inteiro teor do parecer. '.repeat(50) } as Parameters<typeof selectSourceText>[0];
    expect(selectSourceText(doc)).toBe('');
  });

  it('com content presente, continua usando content (não o inteiro teor)', () => {
    const doc = { content: 'ementa e metadados da CONUNI', textoIntegral: 'inteiro teor' } as Parameters<
      typeof selectSourceText
    >[0];
    expect(selectSourceText(doc)).toBe('ementa e metadados da CONUNI');
  });

  it.each(['source-text.ts', 'document-processor.ts'])('%s não menciona textoIntegral', (arquivo) => {
    const fonte = readFileSync(join(__dirname, '..', arquivo), 'utf8');
    expect(fonte).not.toMatch(/\btextoIntegral/);
  });
});
