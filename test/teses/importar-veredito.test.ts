// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { dadosDoVeredito } from '../../lib/tcu/dados-do-veredito';

describe('dadosDoVeredito', () => {
  const agora = new Date('2026-09-09T12:00:00Z');

  it('grava o veredito com autoria e limpa o rastro de heranca', () => {
    expect(dadosDoVeredito('fiel', agora, 'daniel')).toEqual({
      veredito: 'fiel',
      julgadoEm: agora,
      julgadoPor: 'daniel',
      herdadoDe: null,
      reconferenciaPendente: false,
    });
  });

  // O ciclo da spec §5: conferido de novo, o enunciado deixa de ser provisório
  // e volta a ser elegível à vitrine.
  it('limpa a pendencia mesmo quando o veredito reprova', () => {
    expect(dadosDoVeredito('errada', agora, 'daniel').reconferenciaPendente).toBe(false);
  });
});
