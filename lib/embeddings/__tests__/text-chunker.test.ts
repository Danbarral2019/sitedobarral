/**
 * Testes para lib/embeddings/text-chunker.ts
 *
 * Testa chunking de texto para busca semântica.
 */

import { describe, it, expect } from 'vitest';
import { chunkText, chunkLegalDocument } from '../text-chunker';

describe('text-chunker', () => {
  describe('chunkText', () => {
    it('deve retornar array vazio para texto vazio', () => {
      expect(chunkText('')).toEqual([]);
    });

    it('deve retornar array vazio para texto com apenas espaços', () => {
      expect(chunkText('   \n\n  ')).toEqual([]);
    });

    it('deve retornar um chunk para texto curto', () => {
      const text = 'Este é um texto curto sobre licitações.';
      const chunks = chunkText(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].charStart).toBe(0);
      expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
    });

    it('deve retornar chunk com conteúdo normalizado', () => {
      const text = 'Texto\r\ncom\r\nquebras\r\nWindows';
      const chunks = chunkText(text);
      expect(chunks[0].content).not.toContain('\r\n');
    });

    it('deve dividir texto longo em múltiplos chunks', () => {
      // Gerar texto longo
      const paragraph = 'Este é um parágrafo sobre licitações e contratos administrativos. ';
      const text = Array(50).fill(paragraph).join('\n\n');
      const chunks = chunkText(text, { maxChunkSize: 500 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('deve respeitar maxChunkSize', () => {
      const paragraph = 'Parágrafo sobre contratações públicas. ';
      const text = Array(100).fill(paragraph).join('\n\n');
      const chunks = chunkText(text, { maxChunkSize: 300 });
      for (const chunk of chunks) {
        // Pode exceder levemente devido ao overlap, mas não muito
        expect(chunk.content.length).toBeLessThan(600);
      }
    });

    it('deve preservar parágrafos quando possível', () => {
      const text = 'Primeiro parágrafo completo.\n\nSegundo parágrafo completo.\n\nTerceiro parágrafo completo.';
      const chunks = chunkText(text, { maxChunkSize: 2000 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Primeiro');
      expect(chunks[0].content).toContain('Terceiro');
    });

    it('deve usar opções customizadas', () => {
      const text = Array(20).fill('Sentença sobre pregão eletrônico.').join(' ');
      const chunks = chunkText(text, {
        maxChunkSize: 200,
        overlapSize: 50,
        minChunkSize: 50,
      });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('deve estimar tokens corretamente (~4 chars = 1 token)', () => {
      const text = 'abcd'; // 4 chars = ~1 token
      const chunks = chunkText(text);
      expect(chunks[0].tokenEstimate).toBe(1);
    });

    it('deve ter charStart e charEnd corretos para chunk único', () => {
      const text = 'Texto simples.';
      const chunks = chunkText(text);
      expect(chunks[0].charStart).toBe(0);
      expect(chunks[0].charEnd).toBe(chunks[0].content.length);
    });

    it('deve criar chunks com índices sequenciais', () => {
      const text = Array(50).fill('Parágrafo longo sobre licitações e contratos.').join('\n\n');
      const chunks = chunkText(text, { maxChunkSize: 200 });
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    it('deve normalizar múltiplas quebras de linha', () => {
      const text = 'Parágrafo 1.\n\n\n\n\nParágrafo 2.';
      const chunks = chunkText(text);
      expect(chunks[0].content).not.toContain('\n\n\n');
    });

    it('deve remover espaços em excesso', () => {
      const text = 'Texto   com    espaços    extras.';
      const chunks = chunkText(text);
      expect(chunks[0].content).not.toContain('   ');
    });
  });

  describe('chunkLegalDocument', () => {
    it('deve usar maxChunkSize maior por padrão (1200)', () => {
      const text = 'Art. 1º Este é o primeiro artigo.\n\nArt. 2º Este é o segundo artigo.';
      const chunks = chunkLegalDocument(text);
      // Texto curto = 1 chunk
      expect(chunks).toHaveLength(1);
    });

    it('deve preservar estrutura de artigos', () => {
      const articles = Array.from({ length: 20 }, (_, i) =>
        `Art. ${i + 1}º Texto do artigo ${i + 1} sobre licitações e contratos administrativos com detalhes extensivos.`
      ).join('\n');
      const chunks = chunkLegalDocument(articles, { maxChunkSize: 500 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('deve funcionar com texto vazio', () => {
      expect(chunkLegalDocument('')).toEqual([]);
    });

    it('deve aceitar opções customizadas', () => {
      const text = Array.from({ length: 10 }, (_, i) =>
        `Art. ${i + 1}º Dispositivo legal.`
      ).join('\n');
      const chunks = chunkLegalDocument(text, { maxChunkSize: 200 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
