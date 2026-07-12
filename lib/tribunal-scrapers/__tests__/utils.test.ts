// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  normalizeTribunalCode,
  buildFullIdentifier,
  normalizeDecisionNumber,
  extractYear,
  parseBRDate,
  extractTextFromHTML,
} from '../utils';

describe('normalizeTribunalCode', () => {
  it('força UPPERCASE (forma canônica do tribunalCode no DB)', () => {
    expect(normalizeTribunalCode('tce-pe')).toBe('TCE-PE');
    expect(normalizeTribunalCode('stj')).toBe('STJ');
    expect(normalizeTribunalCode('tcu')).toBe('TCU');
  });

  it('é idempotente para códigos já maiúsculos', () => {
    expect(normalizeTribunalCode('TCE-RS')).toBe('TCE-RS');
  });

  it('apara espaços', () => {
    expect(normalizeTribunalCode('  tce-sp  ')).toBe('TCE-SP');
  });
});

describe('buildFullIdentifier', () => {
  it('usa o tribunalCode normalizado (case-estável) no identificador', () => {
    // Mesmo identificador independentemente do case do código de entrada —
    // garante dedup estável entre decisões legadas e novas.
    const lower = buildFullIdentifier('tce-pe', 'acordao', '698/2026');
    const upper = buildFullIdentifier('TCE-PE', 'acordao', '698/2026');
    expect(lower).toBe(upper);
    expect(lower).toContain('TCE-PE');
  });

  it('mapeia o tipo conhecido e normaliza o número (remove prefixo e milhar)', () => {
    expect(buildFullIdentifier('tcu', 'acordao', 'Acórdão nº 1.234/2024')).toBe('TCU Acordao 1234/2024');
  });

  it('mantém o tipo cru quando não está no mapa', () => {
    expect(buildFullIdentifier('tcu', 'consulta', '55/2023')).toBe('TCU consulta 55/2023');
  });
});

describe('normalizeDecisionNumber', () => {
  it('remove prefixo de tipo ("Acórdão", "Decisão", "Súmula")', () => {
    expect(normalizeDecisionNumber('Acórdão 698/2026')).toBe('698/2026');
    expect(normalizeDecisionNumber('Decisão 12/2020')).toBe('12/2020');
    expect(normalizeDecisionNumber('Súmula 45')).toBe('45');
  });

  it('remove prefixo "nº"/"n." e pontos de milhar, preservando /ano', () => {
    expect(normalizeDecisionNumber('nº 1.234/2024')).toBe('1234/2024');
    expect(normalizeDecisionNumber('Acórdão n. 2.567/2023')).toBe('2567/2023');
  });

  it('deixa número já limpo inalterado', () => {
    expect(normalizeDecisionNumber('698/2026')).toBe('698/2026');
  });
});

describe('extractYear', () => {
  it('extrai o ano do formato "número/ano"', () => {
    expect(extractYear('Acórdão 1234/2024')).toBe(2024);
  });

  it('extrai ano isolado de 4 dígitos (20xx)', () => {
    expect(extractYear('decisão publicada em 2023')).toBe(2023);
  });

  it('cai para o ano atual quando não há ano no texto', () => {
    expect(extractYear('sem data aqui')).toBe(new Date().getFullYear());
  });
});

describe('parseBRDate', () => {
  it('parseia DD/MM/YYYY para os componentes corretos', () => {
    const d = parseBRDate('15/03/2024');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2); // março = índice 2
    expect(d!.getDate()).toBe(15);
  });

  it('aceita separador por hífen (DD-MM-YYYY)', () => {
    const d = parseBRDate('01-12-2023');
    expect(d!.getFullYear()).toBe(2023);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(1);
  });

  it('retorna null para string vazia ou sem data', () => {
    expect(parseBRDate('')).toBeNull();
    expect(parseBRDate('nenhuma data')).toBeNull();
  });
});

describe('extractTextFromHTML', () => {
  it('extrai o texto e colapsa espaços', () => {
    expect(extractTextFromHTML('<p>Olá  <b>mundo</b></p>')).toBe('Olá mundo');
  });

  it('remove script/style do texto', () => {
    expect(extractTextFromHTML('<div>conteúdo</div><script>alert(1)</script>')).toBe('conteúdo');
  });

  it('converte <br> em separador de espaço', () => {
    expect(extractTextFromHTML('<div>linha1<br>linha2</div>')).toBe('linha1 linha2');
  });
});
