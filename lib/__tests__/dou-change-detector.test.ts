/**
 * Testes para lib/dou-change-detector.ts
 *
 * Testa detecção de modificações em legislação existente.
 */

import { describe, it, expect } from 'vitest';
import { detectModifications } from '../dou-change-detector';

describe('dou-change-detector', () => {
  describe('detectModifications', () => {
    it('deve retornar null quando não há modificação', () => {
      const result = detectModifications(
        'Comunicado Geral',
        'Informamos a todos os interessados sobre o expediente',
      );
      expect(result).toBeNull();
    });

    it('deve detectar alteração em artigo específico da Lei 14.133', () => {
      const result = detectModifications(
        'Decreto nº 12.000',
        'Altera o Art. 75 da Lei nº 14.133/2021',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.changeType).toBe('altera');
      expect(result!.affectedArticles).toContain('75');
      expect(result!.confidence).toBeGreaterThanOrEqual(90);
    });

    it('deve detectar alteração em múltiplos artigos da Lei 14.133', () => {
      const result = detectModifications(
        'Decreto nº 12.001',
        'Altera os Art. 75, 76 da Lei 14.133',
      );
      expect(result).not.toBeNull();
      expect(result!.affectedArticles).toContain('75');
      expect(result!.affectedArticles).toContain('76');
    });

    it('deve detectar alteração genérica da Lei 14.133', () => {
      const result = detectModifications(
        'Decreto nº 12.002',
        'Altera a Lei nº 14.133/2021',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.changeType).toBe('altera');
      expect(result!.affectedArticles).toHaveLength(0);
      expect(result!.confidence).toBeGreaterThanOrEqual(75);
    });

    it('deve detectar regulamentação de artigo da Lei 14.133', () => {
      const result = detectModifications(
        'Decreto nº 12.003',
        'Regulamenta o Art. 176 da Lei 14.133/2021',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.changeType).toBe('regulamenta');
      expect(result!.affectedArticles).toContain('176');
      expect(result!.confidence).toBeGreaterThanOrEqual(85);
    });

    it('deve detectar revogação de artigo da Lei 14.133 (e extrair o número)', () => {
      const result = detectModifications(
        'Decreto nº 12.004',
        'Revoga o Art. 191 da Lei nº 14.133/2021',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.changeType).toBe('revoga');
      // Regressão: o detector identificava "revoga" mas não extraía o artigo,
      // fazendo affectedArticles=[] e o cron nunca criar LeiArticleNote
      // (auditoria 2026-05-16 P0.3: tabela com 0 registros).
      expect(result!.affectedArticles).toContain('191');
      expect(result!.confidence).toBeGreaterThanOrEqual(85);
    });

    it('deve detectar acréscimo de artigo à Lei 14.133 (forma comum em decretos)', () => {
      const result = detectModifications(
        'Decreto nº 12.343',
        'Acresce o art. 184-A à Lei nº 14.133, de 1º de abril de 2021',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.changeType).toBe('altera');
      expect(result!.affectedArticles).toContain('184-a');
      expect(result!.confidence).toBeGreaterThanOrEqual(85);
    });

    it('deve detectar inclusão de múltiplos artigos na Lei 14.133', () => {
      const result = detectModifications(
        'Lei nº 14.500',
        'Inclui os arts. 195 e 196 na Lei nº 14.133/2021',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.affectedArticles).toContain('195');
      expect(result!.affectedArticles).toContain('196');
    });

    it('deve detectar alteração de IN existente', () => {
      const result = detectModifications(
        'IN SEGES nº 100',
        'Altera a Instrução Normativa nº 58/2022',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesExistingAct).toBe(true);
      expect(result!.existingActRef).not.toBeNull();
      expect(result!.existingActRef!.type).toBe('in');
      expect(result!.existingActRef!.number).toBe('58');
    });

    it('deve detectar alteração de Portaria existente', () => {
      const result = detectModifications(
        'Portaria nº 200',
        'Altera a Portaria nº 443/2020',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesExistingAct).toBe(true);
      expect(result!.existingActRef!.type).toBe('portaria');
      expect(result!.existingActRef!.number).toBe('443');
    });

    it('deve detectar alteração de Decreto existente', () => {
      const result = detectModifications(
        'Decreto nº 12.100',
        'Altera o Decreto nº 11.462/2023',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesExistingAct).toBe(true);
      expect(result!.existingActRef!.type).toBe('decreto');
      expect(result!.existingActRef!.number).toBe('11.462');
    });

    it('deve detectar revogação de IN existente', () => {
      const result = detectModifications(
        'IN SEGES nº 101',
        'Revoga a Instrução Normativa nº 40/2020',
      );
      expect(result).not.toBeNull();
      expect(result!.changeType).toBe('revoga');
      expect(result!.existingActRef!.type).toBe('in');
    });

    it('deve detectar revogação de Portaria', () => {
      const result = detectModifications(
        'Portaria nº 300',
        'Revoga a Portaria nº 100/2019',
      );
      expect(result).not.toBeNull();
      expect(result!.changeType).toBe('revoga');
      expect(result!.existingActRef!.type).toBe('portaria');
    });

    it('deve priorizar alteração da Lei 14.133 sobre alteração de IN', () => {
      const result = detectModifications(
        'Decreto nº 12.200',
        'Altera o Art. 75 da Lei 14.133 e a IN nº 58/2022',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
      expect(result!.changeType).toBe('altera');
    });

    it('deve capturar ano quando disponível em referência a ato', () => {
      const result = detectModifications(
        'IN SEGES nº 200',
        'Altera a Instrução Normativa nº 58 de 2022',
      );
      expect(result).not.toBeNull();
      expect(result!.existingActRef!.year).toBe(2022);
    });

    it('deve funcionar com "lei 14133" sem ponto', () => {
      const result = detectModifications(
        'Decreto',
        'Altera a Lei 14133',
      );
      expect(result).not.toBeNull();
      expect(result!.modifiesLei14133).toBe(true);
    });
  });
});
