// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  normalize,
  extractQuotedSpans,
  validateQuotedCitations,
  buildCitationWarning,
} from '../citation-validator';

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('TEXTO')).toBe('texto');
  });
  it('removes accents', () => {
    expect(normalize('Licitação Eficiência')).toBe('licitacao eficiencia');
  });
  it('collapses whitespace including NBSP', () => {
    expect(normalize('a  b   c\nd')).toBe('a b c d');
  });
  it('strips light punctuation', () => {
    expect(normalize('art. 75, § 1º — inciso (a)')).toBe('art 75 § 1º inciso a');
  });
  it('preserves digits, slash e § ordinal (slash não é pontuação leve)', () => {
    expect(normalize('Lei 14.133/2021 art. 11')).toBe('lei 14133/2021 art 11');
  });
  it('returns empty for whitespace-only', () => {
    expect(normalize('   \n\t  ')).toBe('');
  });
});

describe('extractQuotedSpans', () => {
  it('extracts ASCII double-quoted spans of 20-400 chars', () => {
    const text = 'Lei "este trecho deve ser capturado por ter mais de 20 chars" diz que...';
    expect(extractQuotedSpans(text)).toEqual([
      'este trecho deve ser capturado por ter mais de 20 chars',
    ]);
  });

  it('also catches typographic curly quotes', () => {
    const text = 'Conforme “este enunciado tem mais de vinte chars literalmente”.';
    expect(extractQuotedSpans(text)).toEqual([
      'este enunciado tem mais de vinte chars literalmente',
    ]);
  });

  it('ignores quotes shorter than 20 chars (technical terms)', () => {
    const text = 'O termo "credenciamento" e a "ON 92".';
    expect(extractQuotedSpans(text)).toEqual([]);
  });

  it('ignores quotes longer than 400 chars (block reproduction)', () => {
    const tooLong = 'a'.repeat(401);
    const text = `Início "${tooLong}" fim.`;
    expect(extractQuotedSpans(text)).toEqual([]);
  });

  it('extracts multiple quotes', () => {
    const text =
      'Primeira "trecho com vinte caracteres ok mesmo" e segunda "outro trecho com mais de vinte chars".';
    expect(extractQuotedSpans(text)).toHaveLength(2);
  });

  it('returns empty array when no quotes', () => {
    expect(extractQuotedSpans('Texto sem citação literal alguma.')).toEqual([]);
  });
});

describe('validateQuotedCitations', () => {
  it('marca como válida citação que está literalmente em chunk', () => {
    const answer =
      'Conforme o enunciado, "ainda que isso implique seleção de proposta com preço nominal superior".';
    const chunks = [
      'Texto fonte: ainda que isso implique seleção de proposta com preço nominal superior, deve...',
    ];
    const result = validateQuotedCitations(answer, chunks);
    expect(result.totalQuotes).toBe(1);
    expect(result.validQuotes).toBe(1);
    expect(result.invalidQuotes).toEqual([]);
  });

  it('marca como inválida citação que não está em nenhum chunk (caso IBDA 29)', () => {
    const answer =
      'Enunciado IBDA 29: dever de eficiência impõe a adoção da solução mais vantajosa, "ainda que isso implique seleção de proposta com preço nominal superior".';
    const chunks = [
      'Enunciado IBDA 29: o credenciamento configura hipótese de inexigibilidade quando inviável competição.',
      'Outras fontes sobre ciclo de vida e custos.',
    ];
    const result = validateQuotedCitations(answer, chunks);
    expect(result.totalQuotes).toBe(1);
    expect(result.validQuotes).toBe(0);
    expect(result.invalidQuotes).toHaveLength(1);
    expect(result.invalidQuotes[0]).toMatch(/preço nominal superior/);
  });

  it('tolera variações de espaçamento, acento e pontuação', () => {
    const answer = 'O TCU disse: "Esta é uma decisão importante sobre licitações".';
    const chunks = [
      'Acórdão diz: esta é uma decisão importante sobre licitações, segundo...',
    ];
    const result = validateQuotedCitations(answer, chunks);
    expect(result.validQuotes).toBe(1);
    expect(result.invalidQuotes).toEqual([]);
  });

  it('tolera diferença de NBSP vs espaço normal', () => {
    const answer = 'Texto: "esta frase com nbsp aparece aqui".';
    const chunks = ['Fonte: esta frase com nbsp aparece aqui literalmente.'];
    const result = validateQuotedCitations(answer, chunks);
    expect(result.validQuotes).toBe(1);
  });

  it('valida múltiplas citações independentemente', () => {
    const answer =
      'Primeira "trecho que existe na primeira fonte ok" e segunda "trecho fabricado que ninguém disse".';
    const chunks = ['trecho que existe na primeira fonte ok hoje', 'algo diferente'];
    const result = validateQuotedCitations(answer, chunks);
    expect(result.totalQuotes).toBe(2);
    expect(result.validQuotes).toBe(1);
    expect(result.invalidQuotes).toHaveLength(1);
    expect(result.invalidQuotes[0]).toMatch(/fabricado/);
  });

  it('retorna zero counts quando resposta não tem citações', () => {
    const result = validateQuotedCitations('Resposta sem aspas alguma.', ['chunk']);
    expect(result).toEqual({ totalQuotes: 0, validQuotes: 0, invalidQuotes: [] });
  });

  it('ignora chunks vazios ou null-like', () => {
    const answer = 'Conforme "este trecho com mais de vinte chars literalmente".';
    const chunks = ['', 'este trecho com mais de vinte chars literalmente sim'];
    const result = validateQuotedCitations(answer, chunks);
    expect(result.validQuotes).toBe(1);
  });

  it('trunca citações inválidas longas em 200 chars no relatório', () => {
    const longQuote = 'a'.repeat(300);
    const answer = `Citado "${longQuote}".`;
    const result = validateQuotedCitations(answer, ['chunk irrelevante']);
    expect(result.invalidQuotes[0].length).toBeLessThanOrEqual(200);
  });
});

describe('buildCitationWarning', () => {
  it('retorna vazio quando lista de inválidas é vazia', () => {
    expect(buildCitationWarning([])).toBe('');
  });

  it('inclui contagem singular pra 1 citação', () => {
    const out = buildCitationWarning(['trecho fabricado X']);
    expect(out).toMatch(/1 citação/);
    expect(out).not.toMatch(/citações/);
    expect(out).toMatch(/trecho fabricado X/);
  });

  it('inclui contagem plural pra múltiplas citações', () => {
    const out = buildCitationWarning(['a', 'b', 'c']);
    expect(out).toMatch(/3 citações/);
  });

  it('mostra exemplos truncados em 80 chars', () => {
    const long = 'x'.repeat(100);
    const out = buildCitationWarning([long]);
    expect(out).toMatch(/x{80}\.\.\./);
  });

  it('orienta o aluno a verificar nas fontes', () => {
    const out = buildCitationWarning(['algo']);
    expect(out).toMatch(/Confira/i);
    expect(out).toMatch(/fontes listadas/);
  });
});
