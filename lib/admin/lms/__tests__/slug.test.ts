import { describe, it, expect } from 'vitest';
import { slugify } from '../slug';

describe('slugify', () => {
  it('converte espaços em hífens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('remove acentos', () => {
    expect(slugify('Introdução à Lei')).toBe('introducao-a-lei');
  });

  it('lowercases', () => {
    expect(slugify('UPPER CASE')).toBe('upper-case');
  });

  it('remove caracteres especiais', () => {
    expect(slugify('Aula #1: Análise')).toBe('aula-1-analise');
  });

  it('colapsa hífens múltiplos', () => {
    expect(slugify('a  b   c')).toBe('a-b-c');
  });

  it('remove hífens leading/trailing', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('retorna string vazia pra entrada vazia', () => {
    expect(slugify('')).toBe('');
  });

  it('preserva números', () => {
    expect(slugify('Aula 123')).toBe('aula-123');
  });
});
