import { describe, it, expect } from 'vitest';
import { blocosDoInteiroTeor, escolherInteiroTeor, inteiroTeorTruncado, TETO_INTEIRO_TEOR } from '../inteiro-teor-exibicao';

// Início real do inteiro teor do Acórdão 5890/2021 – 2ª Câmara, como sai do RTF.
const INICIO = [
  'TRIBUNAL DE CONTAS DA UNIÃO\tTC 039.458/2018-0',
  '',
  '1',
  '',
  'GRUPO I – CLASSE VI – Segunda Câmara       ',
  '',
  'TC-039.458/2018-0 ',
  'Natureza: Representação.',
  '',
  'SUMÁRIO: REPRESENTAÇÃO. TOMADA DE PREÇOS. EXIGÊNCIA INDEVIDA DE ÍNDICE DE ENDIVIDAMENTO MENOR OU IGUAL A 0,10. AUDIÊNCIA. REVELIA.',
  '',
  'RELATÓRIO',
  '\t',
  '   \tTrata-se de expediente encaminhado a este Tribunal pela empresa Amaral Castro Engenharia Ltda.',
  '2. \tNa instrução da peça 16, a Secretaria de Infraestrutura Urbana apresentou proposta de mérito.',
  'TRIBUNAL DE CONTAS DA UNIÃO\tTC 039.458/2018-0',
  '2',
  'VOTO',
].join('\n');

describe('blocosDoInteiroTeor', () => {
  const blocos = blocosDoInteiroTeor(INICIO);
  const textos = blocos.map((b) => b.texto);

  it('tira o cabeçalho e o número de cada folha', () => {
    expect(textos.some((t) => t.startsWith('TRIBUNAL DE CONTAS DA UNIÃO'))).toBe(false);
    expect(textos).not.toContain('1');
    expect(textos).not.toContain('2');
  });

  it('marca as seções como título', () => {
    expect(blocos.find((b) => b.texto === 'RELATÓRIO')?.tipo).toBe('titulo');
    expect(blocos.find((b) => b.texto === 'VOTO')?.tipo).toBe('titulo');
  });

  it('não promove a título linha com caixa mista', () => {
    expect(blocos.find((b) => b.texto.startsWith('GRUPO I'))?.tipo).toBe('paragrafo');
  });

  it('mantém como parágrafo o sumário longo, mesmo em maiúsculas', () => {
    expect(blocos.find((b) => b.texto.startsWith('SUMÁRIO'))?.tipo).toBe('paragrafo');
  });

  it('mantém o texto corrido, sem tabulações nem espaços duplicados', () => {
    expect(textos).toContain('Trata-se de expediente encaminhado a este Tribunal pela empresa Amaral Castro Engenharia Ltda.');
    expect(textos).toContain('2. Na instrução da peça 16, a Secretaria de Infraestrutura Urbana apresentou proposta de mérito.');
  });

  it('descarta linhas em branco', () => {
    expect(textos.every((t) => t.length > 0)).toBe(true);
  });
});

describe('inteiroTeorTruncado', () => {
  it('reconhece o texto cortado no teto de gravação', () => {
    expect(inteiroTeorTruncado('x'.repeat(TETO_INTEIRO_TEOR))).toBe(true);
    expect(inteiroTeorTruncado('x'.repeat(1000))).toBe(false);
  });
});

describe('escolherInteiroTeor (seção "Inteiro teor" da página do documento)', () => {
  it('acórdão do TCU: usa tcuTextoCompleto com o rótulo de relatório/voto/acórdão', () => {
    const r = escolherInteiroTeor({ category: 'acordao', tcuTextoCompleto: 'RELATÓRIO ...', textoIntegral: 'outro' });
    expect(r).toEqual({ texto: 'RELATÓRIO ...', subtitulo: 'Relatório, voto e acórdão', avisoLongo: 'Este acórdão é longo demais' });
  });

  it('parecer da AGU: cai para textoIntegral, sem falar em "voto e acórdão"', () => {
    const r = escolherInteiroTeor({ category: 'parecer', tcuTextoCompleto: null, textoIntegral: 'PARECER Nº 1/2026' });
    expect(r?.texto).toBe('PARECER Nº 1/2026');
    expect(r?.subtitulo).toBe('Texto integral do parecer');
    expect(r?.subtitulo).not.toMatch(/acórdão|voto/i);
    expect(r?.avisoLongo).toBe('Este parecer é longo demais');
  });

  it('concorda o aviso com o tipo do documento', () => {
    expect(escolherInteiroTeor({ category: 'nota-tecnica', textoIntegral: 'x' })?.avisoLongo).toBe('Esta nota técnica é longa demais');
    expect(escolherInteiroTeor({ category: 'despacho', textoIntegral: 'x' })?.subtitulo).toBe('Texto integral do despacho');
    expect(escolherInteiroTeor({ category: 'outra', textoIntegral: 'x' })?.subtitulo).toBe('Texto integral');
  });

  it('sem nenhum dos dois (ou só espaços): não há seção', () => {
    expect(escolherInteiroTeor({ category: 'parecer' })).toBeNull();
    expect(escolherInteiroTeor({ category: 'parecer', tcuTextoCompleto: '  ', textoIntegral: '' })).toBeNull();
  });
});
