import { describe, it, expect } from 'vitest';
import {
  CommentSchema,
  CrossRefSchema,
  ReadingSchema,
  ReorderSchema,
} from '../admin-validators';

describe('CommentSchema', () => {
  it('aceita markdown válido', () => {
    expect(CommentSchema.safeParse({ markdown: '# Olá\n\nTexto' }).success).toBe(true);
  });
  it('aceita string vazia (limpar comentário)', () => {
    expect(CommentSchema.safeParse({ markdown: '' }).success).toBe(true);
  });
  it('rejeita > 50k chars', () => {
    expect(CommentSchema.safeParse({ markdown: 'x'.repeat(50_001) }).success).toBe(false);
  });
});

describe('CrossRefSchema', () => {
  it('aceita target válido + nota curta', () => {
    expect(
      CrossRefSchema.safeParse({ targetNumber: '44', note: 'Quando o ETP é dispensado' }).success,
    ).toBe(true);
  });
  it('rejeita target vazio', () => {
    expect(CrossRefSchema.safeParse({ targetNumber: '', note: 'foo' }).success).toBe(false);
  });
  it('rejeita target com letras inválidas (só dígitos + sufixo -X)', () => {
    expect(CrossRefSchema.safeParse({ targetNumber: 'abc', note: 'foo' }).success).toBe(false);
    expect(CrossRefSchema.safeParse({ targetNumber: '184-A', note: 'foo' }).success).toBe(true);
  });
  it('rejeita nota > 500 chars', () => {
    expect(CrossRefSchema.safeParse({ targetNumber: '44', note: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('ReadingSchema', () => {
  it('aceita kind=internal com tipo válido + id', () => {
    expect(
      ReadingSchema.safeParse({
        kind: 'internal',
        internalType: 'blog',
        internalId: 'meu-post',
        description: 'leitura essencial',
      }).success,
    ).toBe(true);
  });
  it('rejeita kind=internal sem internalId', () => {
    expect(
      ReadingSchema.safeParse({ kind: 'internal', internalType: 'blog' }).success,
    ).toBe(false);
  });
  it('aceita kind=external com URL https', () => {
    expect(
      ReadingSchema.safeParse({
        kind: 'external',
        externalUrl: 'https://youtube.com/watch?v=x',
        externalType: 'video',
        title: 'Aula sobre dispensa',
      }).success,
    ).toBe(true);
  });
  it('rejeita kind=external com URL sem protocolo', () => {
    expect(
      ReadingSchema.safeParse({
        kind: 'external',
        externalUrl: 'youtube.com',
        externalType: 'video',
        title: 'foo',
      }).success,
    ).toBe(false);
  });
  it('rejeita internalType inválido', () => {
    expect(
      ReadingSchema.safeParse({ kind: 'internal', internalType: 'foo', internalId: 'x' }).success,
    ).toBe(false);
  });
});

describe('ReorderSchema', () => {
  it('aceita array de IDs válidos', () => {
    expect(ReorderSchema.safeParse({ ids: ['a', 'b', 'c'] }).success).toBe(true);
  });
  it('rejeita array vazio', () => {
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
