// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseCsvLine, buildInformativoShortTitle } from '@/lib/tcu-informativo-scraper';

describe('parseCsvLine (CSV pipe-delimitado do TCU)', () => {
  it('parseia campos simples entre aspas', () => {
    expect(parseCsvLine('"a"|"b"|"c"')).toEqual(['a', 'b', 'c']);
  });

  it('mantém o pipe quando está DENTRO de aspas', () => {
    expect(parseCsvLine('"a|b"|"c"')).toEqual(['a|b', 'c']);
  });

  it('desescapa aspas duplas internas ("")', () => {
    expect(parseCsvLine('"diz ""oi"" ali"|"x"')).toEqual(['diz "oi" ali', 'x']);
  });

  it('lida com o formato real do TCU (XML com aspas escapadas no acórdão)', () => {
    const line =
      '"INFORMATIVO-LC-16225-0"|"Informativo de Licitações e Contratos 520/2026"|"Plenário"|' +
      '"<acordao_decisao_tcu colegiado=""Plenário"" numero=""28"" ano=""2026"" >Acórdão 28/2026 Plenário</acordao_decisao_tcu>"|' +
      '"Na adoção dos critérios de julgamento..."';
    const f = parseCsvLine(line);
    expect(f[0]).toBe('INFORMATIVO-LC-16225-0');
    expect(f[1]).toBe('Informativo de Licitações e Contratos 520/2026');
    expect(f[2]).toBe('Plenário');
    expect(f[3]).toContain('Acórdão 28/2026 Plenário');
    expect(f[3]).toContain('numero="28"'); // aspas desescapadas
    expect(f[4]).toBe('Na adoção dos critérios de julgamento...');
  });

  it('campo vazio vira string vazia', () => {
    expect(parseCsvLine('"a"||"c"')).toEqual(['a', '', 'c']);
  });
});

describe('buildInformativoShortTitle', () => {
  it('usa a primeira frase quando ela é curta o suficiente', () => {
    const t = buildInformativoShortTitle('520/2026', 'É irregular exigir atestado único. O restante do texto segue aqui detalhando.');
    expect(t).toBe('Inf. 520/2026 — É irregular exigir atestado único.');
  });

  it('trunca em fronteira de palavra com reticências quando não há frase curta', () => {
    const longo = 'Na adoção dos critérios de julgamento melhor técnica ou técnica e preço não é irregular a atribuição de critérios de pontuação técnica que valorizem a experiência prévia do licitante desde que pertinentes';
    const t = buildInformativoShortTitle('520/2026', longo);
    expect(t.startsWith('Inf. 520/2026 — ')).toBe(true);
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThan(160);
    // Cortou em fronteira de palavra: o texto antes do … não termina com palavra partida
    const body = t.replace(/…$/, '');
    expect(longo.startsWith(body.replace('Inf. 520/2026 — ', ''))).toBe(true);
  });

  it('normaliza espaços em branco', () => {
    const t = buildInformativoShortTitle('1/2010', 'Texto   com\n\nespaços   irregulares.');
    expect(t).toBe('Inf. 1/2010 — Texto com espaços irregulares.');
  });
});
