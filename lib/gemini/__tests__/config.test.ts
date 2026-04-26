// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  isPremiumChatQuery,
  isPremiumDetectorEnabled,
} from '../config';

const ORIGINAL_PREMIUM_CHAT = process.env.USE_PREMIUM_FOR_CHAT;
const ORIGINAL_PREMIUM_DETECTOR = process.env.USE_PREMIUM_FOR_DETECTOR;

beforeEach(() => {
  delete process.env.USE_PREMIUM_FOR_CHAT;
  delete process.env.USE_PREMIUM_FOR_DETECTOR;
});

afterEach(() => {
  if (ORIGINAL_PREMIUM_CHAT === undefined) {
    delete process.env.USE_PREMIUM_FOR_CHAT;
  } else {
    process.env.USE_PREMIUM_FOR_CHAT = ORIGINAL_PREMIUM_CHAT;
  }
  if (ORIGINAL_PREMIUM_DETECTOR === undefined) {
    delete process.env.USE_PREMIUM_FOR_DETECTOR;
  } else {
    process.env.USE_PREMIUM_FOR_DETECTOR = ORIGINAL_PREMIUM_DETECTOR;
  }
});

describe('isPremiumChatQuery', () => {
  it('retorna false quando USE_PREMIUM_FOR_CHAT não está setado (default off)', () => {
    expect(isPremiumChatQuery('compare a lei 14133 com a 8666')).toBe(false);
    expect(isPremiumChatQuery('a'.repeat(500))).toBe(false);
  });

  it('retorna false quando USE_PREMIUM_FOR_CHAT=false', () => {
    process.env.USE_PREMIUM_FOR_CHAT = 'false';
    expect(isPremiumChatQuery('compare a lei 14133 com a 8666')).toBe(false);
  });

  it('retorna false para query vazia mesmo com flag on', () => {
    process.env.USE_PREMIUM_FOR_CHAT = 'true';
    expect(isPremiumChatQuery('')).toBe(false);
  });

  it('retorna true quando query tem ≥200 chars (com flag on)', () => {
    process.env.USE_PREMIUM_FOR_CHAT = 'true';
    expect(isPremiumChatQuery('a'.repeat(200))).toBe(true);
    expect(isPremiumChatQuery('a'.repeat(199))).toBe(false);
  });

  it('retorna true para verbos analíticos (compare, relacione, etc.)', () => {
    process.env.USE_PREMIUM_FOR_CHAT = 'true';
    expect(isPremiumChatQuery('Compare o art. 75 com o anterior')).toBe(true);
    expect(isPremiumChatQuery('Qual a relação entre licitação e dispensa?')).toBe(true);
    expect(isPremiumChatQuery('Como interpretar o caput?')).toBe(true);
    expect(isPremiumChatQuery('Fundamente a posição doutrinária')).toBe(true);
    expect(isPremiumChatQuery('Quais as diferenças entre as modalidades?')).toBe(true);
    expect(isPremiumChatQuery('Implicações práticas?')).toBe(true);
    expect(isPremiumChatQuery('Hipótese de inexigibilidade')).toBe(true);
    expect(isPremiumChatQuery('analise o art. 75')).toBe(true);
    expect(isPremiumChatQuery('Há contradição entre os incisos?')).toBe(true);
    expect(isPremiumChatQuery('Aplicabilidade ao TCU')).toBe(true);
  });

  it('é case-insensitive', () => {
    process.env.USE_PREMIUM_FOR_CHAT = 'true';
    expect(isPremiumChatQuery('COMPARE artigos')).toBe(true);
    expect(isPremiumChatQuery('Implicações')).toBe(true);
  });

  it('retorna false para queries simples (com flag on, sem trigger)', () => {
    process.env.USE_PREMIUM_FOR_CHAT = 'true';
    expect(isPremiumChatQuery('o que diz o art. 75?')).toBe(false);
    expect(isPremiumChatQuery('quem é o relator?')).toBe(false);
  });
});

describe('isPremiumDetectorEnabled', () => {
  it('retorna false quando USE_PREMIUM_FOR_DETECTOR não está setado', () => {
    expect(isPremiumDetectorEnabled()).toBe(false);
  });

  it('retorna false quando USE_PREMIUM_FOR_DETECTOR=false', () => {
    process.env.USE_PREMIUM_FOR_DETECTOR = 'false';
    expect(isPremiumDetectorEnabled()).toBe(false);
  });

  it('retorna true só quando USE_PREMIUM_FOR_DETECTOR=true', () => {
    process.env.USE_PREMIUM_FOR_DETECTOR = 'true';
    expect(isPremiumDetectorEnabled()).toBe(true);
  });

  it('é estrito sobre o valor "true" (1, yes, on não contam)', () => {
    process.env.USE_PREMIUM_FOR_DETECTOR = '1';
    expect(isPremiumDetectorEnabled()).toBe(false);
    process.env.USE_PREMIUM_FOR_DETECTOR = 'yes';
    expect(isPremiumDetectorEnabled()).toBe(false);
  });
});
