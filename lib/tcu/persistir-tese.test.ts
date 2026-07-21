import { describe, it, expect } from 'vitest';
import { ehElegivel, MIN_NO_VOTO, FATOR_CRESCIMENTO, DIAS_MINIMOS } from './persistir-tese';

const agora = new Date('2026-07-21T12:00:00Z');
const diasAtras = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000);

describe('ehElegivel — nunca destilado', () => {
  it('entra na fila com 5 citantes no voto', () => expect(ehElegivel(5, null, agora)).toBe(true));
  it('entra com mais de 5', () => expect(ehElegivel(40, null, agora)).toBe(true));
  it('NAO entra com 4 — abaixo do limiar em que o motor produz tese', () =>
    expect(ehElegivel(4, null, agora)).toBe(false));
  it('NAO entra com zero', () => expect(ehElegivel(0, null, agora)).toBe(false));
});

describe('ehElegivel — ja destilado', () => {
  it('redestila quando cresceu 50% e passaram mais de 7 dias', () =>
    expect(ehElegivel(15, { dossieNoVoto: 10, criadoEm: diasAtras(8) }, agora)).toBe(true));

  it('NAO redestila quando cresceu pouco, mesmo com muito tempo', () =>
    expect(ehElegivel(14, { dossieNoVoto: 10, criadoEm: diasAtras(90) }, agora)).toBe(false));

  it('NAO redestila quando cresceu muito mas e recente — evita cascata durante a campanha', () =>
    expect(ehElegivel(100, { dossieNoVoto: 10, criadoEm: diasAtras(1) }, agora)).toBe(false));

  it('NAO redestila exatamente em 7 dias (exige MAIS de 7)', () =>
    expect(ehElegivel(20, { dossieNoVoto: 10, criadoEm: diasAtras(7) }, agora)).toBe(false));

  it('NAO redestila se o dossie encolheu', () =>
    expect(ehElegivel(5, { dossieNoVoto: 40, criadoEm: diasAtras(30) }, agora)).toBe(false));
});

describe('constantes travadas pela spec', () => {
  it('os tres limiares sao os da spec', () => {
    expect(MIN_NO_VOTO).toBe(5);
    expect(FATOR_CRESCIMENTO).toBe(1.5);
    expect(DIAS_MINIMOS).toBe(7);
  });
});
