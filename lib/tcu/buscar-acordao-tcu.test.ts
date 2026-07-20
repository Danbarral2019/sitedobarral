import { describe, it, expect } from 'vitest';
import { parseEntidade, escolherCandidato } from './buscar-acordao-tcu';

const ent = (titulo: string, subtitulo: string, texto: string, key: string) => ({
  titulo,
  subtitulo,
  texto,
  link: `https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*/KEY:${key}/NUMACORDAOINT asc/0`,
});

describe('parseEntidade', () => {
  it('extrai numero, ano, colegiado, relator, ementa e key', () => {
    const c = parseEntidade(
      ent('ACÓRDÃO 2622/2013 ATA 37/2013 - PLENÁRIO', 'Relator: Marcos Bemquerer', 'Administrativo. BDI.', 'ACORDAO-COMPLETO-1286063')
    );
    expect(c).not.toBeNull();
    expect(c!.numero).toBe(2622);
    expect(c!.ano).toBe(2013);
    expect(c!.colegiado).toBe('Plenário');
    expect(c!.relator).toBe('Marcos Bemquerer');
    expect(c!.ementa).toBe('Administrativo. BDI.');
    expect(c!.key).toBe('ACORDAO-COMPLETO-1286063');
    expect(c!.link).toBe('https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-1286063');
  });

  it('retorna null quando falta a KEY', () => {
    expect(parseEntidade({ titulo: 'ACÓRDÃO 1/2020 - PLENÁRIO', link: 'https://x/sem-key' })).toBeNull();
  });

  it('normaliza número com ponto de milhar', () => {
    const c = parseEntidade(ent('ACÓRDÃO 11.762/2018 ATA 1/2018 - SEGUNDA CÂMARA', 'Relator: X', 'e', 'ACORDAO-COMPLETO-1'));
    expect(c!.numero).toBe(11762);
    expect(c!.colegiado).toBe('Segunda Câmara');
  });
});

describe('escolherCandidato', () => {
  const mk = (colegiado: string, key: string, titulo = `ACÓRDÃO 2622/2013 - ${colegiado.toUpperCase()}`) =>
    parseEntidade(ent(titulo, 'Relator: X', 'ementa', key))!;

  it('prefere o colegiado indicado quando existe', () => {
    const cands = [mk('Segunda Câmara', 'ACORDAO-COMPLETO-2'), mk('Plenário', 'ACORDAO-COMPLETO-1')];
    expect(escolherCandidato(cands, 'Plenário')!.key).toBe('ACORDAO-COMPLETO-1');
  });

  it('descarta "acórdão de relação" quando há alternativa completa', () => {
    const relacao = parseEntidade(ent('ACÓRDÃO DE RELAÇÃO 2622/2013 - PRIMEIRA CÂMARA', 'Relator: Y', '', 'ACORDAO-COMPLETO-3'))!;
    const completo = mk('Plenário', 'ACORDAO-COMPLETO-1');
    expect(escolherCandidato([relacao, completo])!.key).toBe('ACORDAO-COMPLETO-1');
  });

  it('acórdão de relação preserva a KEY real e marca isRelacao', () => {
    const c = parseEntidade({
      titulo: 'ACÓRDÃO DE RELAÇÃO 2622/2013 - PRIMEIRA CÂMARA',
      subtitulo: 'Relator: Y',
      texto: '',
      link: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*/KEY:ACORDAO-COMPLETO-3/NUMACORDAOINT asc/0',
    })!;
    expect(c.isRelacao).toBe(true);
    expect(c.key).toBe('ACORDAO-COMPLETO-3'); // KEY real preservada, não fabricada
    expect(c.link).toBe('https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-3');
  });
});
