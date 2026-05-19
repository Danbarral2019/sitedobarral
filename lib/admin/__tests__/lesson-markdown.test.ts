/**
 * Testes para lib/admin/lesson-markdown.ts
 *
 * Conversor markdown -> HTML simples usado no preview do editor de licao.
 * NAO sanitiza HTML (apenas transforma sintaxe markdown). Caller usa
 * dangerouslySetInnerHTML aceitando input confiavel do admin.
 */

import { describe, it, expect } from 'vitest';
import { simpleMarkdownToHtml } from '../lesson-markdown';

describe('simpleMarkdownToHtml', () => {
  describe('headers', () => {
    it('converte # para h1', () => {
      expect(simpleMarkdownToHtml('# Titulo')).toContain('<h1 class="text-2xl font-bold mt-6 mb-4">Titulo</h1>');
    });

    it('converte ## para h2', () => {
      expect(simpleMarkdownToHtml('## Sub')).toContain('<h2 class="text-xl font-bold mt-6 mb-3">Sub</h2>');
    });

    it('converte ### para h3', () => {
      expect(simpleMarkdownToHtml('### Mini')).toContain('<h3 class="text-lg font-semibold mt-4 mb-2">Mini</h3>');
    });
  });

  describe('inline', () => {
    it('converte **texto** para strong', () => {
      expect(simpleMarkdownToHtml('Isso e **bold**')).toContain('<strong>bold</strong>');
    });

    it('converte *texto* para em', () => {
      expect(simpleMarkdownToHtml('Isso e *italic*')).toContain('<em>italic</em>');
    });
  });

  describe('listas', () => {
    it('converte - linha em li', () => {
      expect(simpleMarkdownToHtml('- item')).toContain('<li class="ml-4">item</li>');
    });

    it('envolve sequencia de li em ul', () => {
      const html = simpleMarkdownToHtml('- a\n- b\n- c');
      expect(html).toContain('<ul class="list-disc my-2">');
      expect(html).toContain('<li class="ml-4">a</li>');
      expect(html).toContain('<li class="ml-4">c</li>');
    });
  });

  describe('quebras de linha', () => {
    it('converte \\n em <br/>', () => {
      expect(simpleMarkdownToHtml('linha1\nlinha2')).toContain('<br/>');
    });
  });

  describe('edge cases', () => {
    it('retorna string vazia para entrada vazia', () => {
      expect(simpleMarkdownToHtml('')).toBe('');
    });

    it('preserva texto sem markdown', () => {
      expect(simpleMarkdownToHtml('texto simples')).toBe('texto simples');
    });

    it('combina varios formatos', () => {
      const out = simpleMarkdownToHtml('# T\n\n**bold** e *italic*');
      expect(out).toContain('<h1');
      expect(out).toContain('<strong>bold</strong>');
      expect(out).toContain('<em>italic</em>');
    });
  });
});
