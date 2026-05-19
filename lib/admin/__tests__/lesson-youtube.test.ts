/**
 * Testes para lib/admin/lesson-youtube.ts
 *
 * Extrai o YouTube video ID de URLs diversas ou de IDs nus de 11 chars.
 */

import { describe, it, expect } from 'vitest';
import { extractYoutubeId } from '../lesson-youtube';

describe('extractYoutubeId', () => {
  describe('URLs validas', () => {
    it('aceita youtube.com/watch?v=', () => {
      expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('aceita youtu.be/', () => {
      expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('aceita youtube.com/embed/', () => {
      expect(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('aceita URL com query string adicional apos o ID', () => {
      expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
    });

    it('aceita ID nu de 11 chars', () => {
      expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('aceita IDs com underscore e hyphen', () => {
      expect(extractYoutubeId('https://youtu.be/abc_def-XYZ')).toBe('abc_def-XYZ');
    });
  });

  describe('inputs invalidos', () => {
    it('retorna null para string vazia', () => {
      expect(extractYoutubeId('')).toBeNull();
    });

    it('retorna null para URL sem ID', () => {
      expect(extractYoutubeId('https://www.youtube.com/')).toBeNull();
    });

    it('retorna null para texto random', () => {
      expect(extractYoutubeId('isso nao e uma url')).toBeNull();
    });

    it('retorna null para ID nu com tamanho diferente de 11', () => {
      expect(extractYoutubeId('abc')).toBeNull();
      expect(extractYoutubeId('abcdefghijklmnop')).toBeNull();
    });

    it('retorna null para URL de outro dominio', () => {
      expect(extractYoutubeId('https://vimeo.com/123456')).toBeNull();
    });
  });
});
