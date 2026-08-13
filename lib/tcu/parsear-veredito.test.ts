import { describe, it, expect } from 'vitest';
import { parsearVeredito } from './parsear-veredito';

const CABECALHO = 'CALIBRAÇÃO DE TESES — Rede de precedentes TCU\n\nVEREDITOS POR CASO:\n';

describe('parsearVeredito — vereditos por caso', () => {
  it('extrai a chave e o veredito de uma linha julgada', () => {
    const out = parsearVeredito(`${CABECALHO}  Acórdão 2622/2013: fiel\n`);

    expect(out.casos).toEqual([{ chave: '2622/2013', veredito: 'fiel' }]);
  });

  it('ignora o caso pendente em vez de gravar veredito nulo', () => {
    const out = parsearVeredito(`${CABECALHO}  Acórdão 2622/2013: fiel\n  Acórdão 2442/2025: (pendente)\n`);

    expect(out.casos).toEqual([{ chave: '2622/2013', veredito: 'fiel' }]);
    expect(out.pendentes).toBe(1);
  });

  it('aceita os três vereditos da folha', () => {
    const out = parsearVeredito(
      `${CABECALHO}  Acórdão 1/2020: fiel\n  Acórdão 2/2020: imprecisa\n  Acórdão 3/2020: errada\n`
    );

    expect(out.casos.map((c) => c.veredito)).toEqual(['fiel', 'imprecisa', 'errada']);
  });
});

describe('parsearVeredito — vereditos por divergência', () => {
  const COM_DIV = `${CABECALHO}  Acórdão 465/2024: fiel\n\nVEREDITOS POR DIVERGÊNCIA:\n`;

  it('converte o índice exibido (1-based) para o índice do array (0-based)', () => {
    const out = parsearVeredito(`${COM_DIV}  Acórdão 465/2024 / divergência 1: procede\n`);

    expect(out.divergencias).toEqual([{ chave: '465/2024', indice: 0, veredito: 'procede' }]);
  });

  it('aceita naoprocede', () => {
    const out = parsearVeredito(`${COM_DIV}  Acórdão 465/2024 / divergência 2: naoprocede\n`);

    expect(out.divergencias).toEqual([{ chave: '465/2024', indice: 1, veredito: 'naoprocede' }]);
  });

  it('não confunde a linha de divergência com um veredito de caso', () => {
    const out = parsearVeredito(`${COM_DIV}  Acórdão 465/2024 / divergência 1: procede\n`);

    expect(out.casos).toEqual([{ chave: '465/2024', veredito: 'fiel' }]);
  });
});

describe('parsearVeredito — entrada que não deve virar gravação', () => {
  it('recolhe a linha com veredito desconhecido em vez de gravá-la', () => {
    const out = parsearVeredito(`${CABECALHO}  Acórdão 2622/2013: talvez\n`);

    expect(out.casos).toEqual([]);
    expect(out.invalidas).toEqual(['  Acórdão 2622/2013: talvez']);
  });

  it('recusa veredito de caso na seção de divergências', () => {
    const texto = `${CABECALHO}\nVEREDITOS POR DIVERGÊNCIA:\n  Acórdão 465/2024 / divergência 1: fiel\n`;
    const out = parsearVeredito(texto);

    expect(out.divergencias).toEqual([]);
    expect(out.invalidas).toHaveLength(1);
  });

  it('ignora cabeçalhos e linhas em branco sem contá-los como inválidos', () => {
    const out = parsearVeredito(`${CABECALHO}  Acórdão 2622/2013: fiel\n\n`);

    expect(out.invalidas).toEqual([]);
  });
});
