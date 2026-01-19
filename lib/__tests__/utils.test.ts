/**
 * Testes para lib/utils.ts
 *
 * Testa funções utilitárias: safeParseArray, formatNumber, formatBytes,
 * truncate, slugify e debounce.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  safeParseArray,
  formatNumber,
  formatBytes,
  truncate,
  slugify,
  debounce,
} from '../utils';

describe('Utils Module', () => {
  describe('safeParseArray', () => {
    describe('JSON input', () => {
      it('deve parsear array JSON válido', () => {
        const result = safeParseArray('["tag1","tag2","tag3"]');
        expect(result).toEqual(['tag1', 'tag2', 'tag3']);
      });

      it('deve parsear array JSON vazio', () => {
        const result = safeParseArray('[]');
        expect(result).toEqual([]);
      });

      it('deve parsear array JSON com um elemento', () => {
        const result = safeParseArray('["único"]');
        expect(result).toEqual(['único']);
      });

      it('deve parsear array JSON com caracteres especiais', () => {
        const result = safeParseArray('["tag com espaço","tag/com/barra"]');
        expect(result).toEqual(['tag com espaço', 'tag/com/barra']);
      });
    });

    describe('CSV input', () => {
      it('deve parsear CSV simples', () => {
        const result = safeParseArray('tag1,tag2,tag3');
        expect(result).toEqual(['tag1', 'tag2', 'tag3']);
      });

      it('deve trimmar espaços em CSV', () => {
        const result = safeParseArray('tag1, tag2 , tag3');
        expect(result).toEqual(['tag1', 'tag2', 'tag3']);
      });

      it('deve remover itens vazios em CSV', () => {
        const result = safeParseArray('tag1,,tag2,,,tag3');
        expect(result).toEqual(['tag1', 'tag2', 'tag3']);
      });

      it('deve parsear CSV com um elemento', () => {
        const result = safeParseArray('único');
        expect(result).toEqual(['único']);
      });
    });

    describe('Array input', () => {
      it('deve retornar array diretamente', () => {
        const input = ['a', 'b', 'c'];
        const result = safeParseArray(input);
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('deve retornar array vazio diretamente', () => {
        const result = safeParseArray([]);
        expect(result).toEqual([]);
      });
    });

    describe('Null/undefined input', () => {
      it('deve retornar array vazio para null', () => {
        const result = safeParseArray(null);
        expect(result).toEqual([]);
      });

      it('deve retornar array vazio para undefined', () => {
        const result = safeParseArray(undefined);
        expect(result).toEqual([]);
      });

      it('deve retornar array vazio para string vazia', () => {
        const result = safeParseArray('');
        expect(result).toEqual([]);
      });
    });

    describe('Invalid input', () => {
      it('deve retornar array vazio para número', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = safeParseArray(123 as unknown);
        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('deve retornar array vazio para objeto', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = safeParseArray({ key: 'value' } as unknown);
        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('deve retornar array vazio para JSON object (não array)', () => {
        const result = safeParseArray('{"key":"value"}');
        expect(result).toEqual([]);
      });
    });
  });

  describe('formatNumber', () => {
    it('deve formatar número com separador de milhar pt-BR', () => {
      const result = formatNumber(1234567);
      expect(result).toBe('1.234.567');
    });

    it('deve formatar número pequeno sem separador', () => {
      const result = formatNumber(100);
      expect(result).toBe('100');
    });

    it('deve formatar zero', () => {
      const result = formatNumber(0);
      expect(result).toBe('0');
    });

    it('deve formatar número negativo', () => {
      const result = formatNumber(-1234);
      expect(result).toBe('-1.234');
    });

    it('deve formatar número decimal', () => {
      const result = formatNumber(1234.56);
      expect(result).toBe('1.234,56');
    });
  });

  describe('formatBytes', () => {
    it('deve retornar "0 B" para zero bytes', () => {
      const result = formatBytes(0);
      expect(result).toBe('0 B');
    });

    it('deve formatar bytes pequenos', () => {
      const result = formatBytes(500);
      expect(result).toBe('500 B');
    });

    it('deve formatar kilobytes', () => {
      const result = formatBytes(1024);
      expect(result).toBe('1 KB');
    });

    it('deve formatar megabytes', () => {
      const result = formatBytes(1048576);
      expect(result).toBe('1 MB');
    });

    it('deve formatar gigabytes', () => {
      const result = formatBytes(1073741824);
      expect(result).toBe('1 GB');
    });

    it('deve formatar com decimais quando necessário', () => {
      const result = formatBytes(1536);
      expect(result).toBe('1.5 KB');
    });

    it('deve formatar valores grandes corretamente', () => {
      const result = formatBytes(5368709120); // 5 GB
      expect(result).toBe('5 GB');
    });
  });

  describe('truncate', () => {
    it('deve truncar texto maior que maxLength', () => {
      const result = truncate('Lorem ipsum dolor sit amet', 10);
      expect(result).toBe('Lorem ipsu...');
    });

    it('não deve truncar texto menor que maxLength', () => {
      const result = truncate('Curto', 10);
      expect(result).toBe('Curto');
    });

    it('não deve truncar texto igual ao maxLength', () => {
      const result = truncate('1234567890', 10);
      expect(result).toBe('1234567890');
    });

    it('deve usar maxLength padrão de 100', () => {
      const longText = 'a'.repeat(150);
      const result = truncate(longText);
      expect(result).toBe('a'.repeat(100) + '...');
    });

    it('deve lidar com texto vazio', () => {
      const result = truncate('', 10);
      expect(result).toBe('');
    });

    it('deve lidar com maxLength 0', () => {
      const result = truncate('Texto', 0);
      expect(result).toBe('...');
    });
  });

  describe('slugify', () => {
    it('deve converter para minúsculas', () => {
      const result = slugify('TEXTO MAIÚSCULO');
      expect(result).toBe('texto-maiusculo');
    });

    it('deve remover acentos', () => {
      const result = slugify('Licitações e Contratos');
      expect(result).toBe('licitacoes-e-contratos');
    });

    it('deve converter espaços em hífens', () => {
      const result = slugify('Direito Administrativo');
      expect(result).toBe('direito-administrativo');
    });

    it('deve remover caracteres especiais', () => {
      const result = slugify('Lei 14.133/2021');
      expect(result).toBe('lei-141332021');
    });

    it('deve remover hífens duplicados', () => {
      const result = slugify('Texto - com -- vários --- hífens');
      expect(result).toBe('texto-com-varios-hifens');
    });

    it('deve lidar com string vazia', () => {
      const result = slugify('');
      expect(result).toBe('');
    });

    it('deve lidar com caracteres unicode', () => {
      const result = slugify('Gestão e Fiscalização');
      expect(result).toBe('gestao-e-fiscalizacao');
    });

    it('deve criar slug válido para URL', () => {
      const result = slugify('Nova Lei de Licitações (Lei 14.133/2021)');
      expect(result).toBe('nova-lei-de-licitacoes-lei-141332021');
      // Verifica se não tem caracteres inválidos para URL
      expect(result).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('deve atrasar execução da função', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('deve cancelar chamada anterior se chamado novamente', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn();
      vi.advanceTimersByTime(200);
      debouncedFn(); // Reinicia o timer
      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('deve passar argumentos para função', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('deve usar apenas os argumentos da última chamada', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn('primeiro');
      debouncedFn('segundo');
      debouncedFn('terceiro');
      vi.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('terceiro');
    });

    it('deve usar tempo padrão de 300ms', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn);

      debouncedFn();
      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('deve permitir múltiplas execuções após timeout', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);

      debouncedFn();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
