// @vitest-environment node
//
// Cobre o defeito da rodada de correção 1 da Task 4: a fila de reconferência
// é selecionada FORA dos recortes de --min-no-voto/--tema, então pode conter
// uma chave ausente de `cards` (DATA na folha). Sem uma seção própria no
// texto de export para essas chaves, o veredito marcado no cartão de
// reconferência ficava salvo em `store.cards` mas sumia do texto exportado.
import { describe, it, expect } from 'vitest';
import { montarLinhasVeredito, renderFolha } from '../../scripts/lib/folha-teses-template.mjs';

/** Recorta o conteúdo de `<script>...</script>` do HTML gerado por `renderFolha`. */
function extrairScript(html: string): string {
  const abre = html.indexOf('<script>');
  const fecha = html.indexOf('</script>', abre);
  if (abre === -1 || fecha === -1) throw new Error('bloco <script> não encontrado no HTML gerado');
  return html.slice(abre + '<script>'.length, fecha);
}

/**
 * Extrai o texto-fonte de uma função declarada no script, por casamento de
 * chaves — ignorando chaves dentro de literais de string, para não parar
 * cedo demais num '}' que apareça dentro de uma string. É o mesmo texto que
 * `Function.prototype.toString()` embutiu no HTML (ver o comentário acima de
 * `montarLinhasVeredito` em folha-teses-template.mjs); reconstruído aqui para
 * ser avaliado isoladamente, longe de `DATA`/`store`/qualquer outra variável
 * do script gerado — se a função embutida ganhar uma referência externa, essa
 * reconstrução não a resolve, e chamar a função reconstruída lança
 * `ReferenceError` em vez de silenciosamente concordar com a importada.
 */
function extrairFuncao(script: string, nome: string): string {
  const marca = 'function ' + nome;
  const inicio = script.indexOf(marca);
  if (inicio === -1) throw new Error(`"${nome}" não encontrada no script embutido`);
  const aberturaChave = script.indexOf('{', inicio);
  let profundidade = 0;
  let emString: string | null = null;
  for (let i = aberturaChave; i < script.length; i++) {
    const c = script[i];
    if (emString) {
      if (c === '\\') { i++; continue; }
      if (c === emString) emString = null;
      continue;
    }
    if (c === "'" || c === '"') { emString = c; continue; }
    if (c === '{') profundidade++;
    else if (c === '}') {
      profundidade--;
      if (profundidade === 0) return script.slice(inicio, i + 1);
    }
  }
  throw new Error(`chave de fechamento de "${nome}" não encontrada`);
}

describe('montarLinhasVeredito', () => {
  it('lista as chaves de DATA na ordem dada, marcando pendente quando falta veredito', () => {
    const linhas = montarLinhasVeredito(['1441/2016', '999/2020'], [], { '1441/2016': 'fiel' });
    expect(linhas).toEqual([
      'VEREDITOS POR CASO:',
      '  Acórdão 1441/2016: fiel',
      '  Acórdão 999/2020: (pendente)',
    ]);
  });

  it('não abre a seção de reconferência quando toda chave da fila já está em DATA', () => {
    const linhas = montarLinhasVeredito(['1441/2016'], ['1441/2016'], { '1441/2016': 'imprecisa' });
    expect(linhas).toEqual(['VEREDITOS POR CASO:', '  Acórdão 1441/2016: imprecisa']);
  });

  // O bug: --min-no-voto/--tema excluíram 500/2019 de DATA, mas a fila de
  // reconferência (selecionada fora desses recortes) ainda o inclui, e o
  // veredito marcado nesse cartão não pode sumir do export.
  it('acrescenta seção própria para chave de reconferência ausente de DATA', () => {
    const linhas = montarLinhasVeredito(['1441/2016'], ['500/2019'], {
      '1441/2016': 'fiel',
      '500/2019': 'errada',
    });
    expect(linhas).toEqual([
      'VEREDITOS POR CASO:',
      '  Acórdão 1441/2016: fiel',
      '',
      'VEREDITOS POR CASO (RECONFERÊNCIA, FORA DO RECORTE DESTA FOLHA):',
      '  Acórdão 500/2019: errada',
    ]);
  });

  it('marca pendente a chave extra de reconferência ainda não julgada', () => {
    const linhas = montarLinhasVeredito(['1441/2016'], ['500/2019'], { '1441/2016': 'fiel' });
    expect(linhas).toContain('  Acórdão 500/2019: (pendente)');
  });

  it('não repete a mesma chave extra duas vezes quando a fila tem duas pendências do mesmo caso', () => {
    const linhas = montarLinhasVeredito([], ['500/2019', '500/2019'], { '500/2019': 'fiel' });
    expect(linhas.filter((l) => l.includes('500/2019'))).toHaveLength(1);
  });
});

// Rodada de correção 2: a garantia de que `montarLinhasVeredito` funciona no
// navegador dependia, até aqui, de ela ser autocontida — verificado por
// inspeção humana, não por teste. Uma referência futura a `DATA`/`store`
// dentro da função pareceria inofensiva (essas variáveis existem no <script>
// gerado) e quebraria só no navegador, sem nenhum teste em Node percebendo,
// porque os testes acima importam a função direto do módulo — não a cópia
// embutida. Esta seção exercita a cópia embutida de fato.
describe('a função embutida no HTML gerado por renderFolha', () => {
  const cardMinimo = {
    chave: '1441/2016',
    assunto: 'assunto de teste',
    confianca: null,
    contagem: { noVoto: 1, citantesDistintos: 1, ocorrenciasTotal: 1 },
    teses: [],
    sinais: [],
    divergencias: [],
  };
  // A chave que fica fora do recorte de --min-no-voto/--tema (ausente de
  // `cards`) é o caso que pega a regressão do item 3, abaixo.
  const cartaoReconf = {
    chave: '500/2019',
    enunciadoNovo: 'redação nova',
    enunciadoAnterior: 'redação aprovada',
    julgadoPor: 'daniel',
    julgadoEm: new Date('2026-08-01T00:00:00Z'),
  };
  const html = renderFolha({
    cards: [cardMinimo],
    geradoEm: '2026-09-09',
    cartoesReconferencia: [cartaoReconf],
  });
  const script = extrairScript(html);

  it('o <script> gerado é sintaticamente válido', () => {
    expect(() => new Function(script)).not.toThrow();
  });

  it('a função embutida aparece uma única vez', () => {
    const ocorrencias = script.match(/function montarLinhasVeredito\(/g) ?? [];
    expect(ocorrencias).toHaveLength(1);
  });

  it('a função embutida, extraída e reconstruída isoladamente, produz o mesmo resultado que a importada — para uma chave de reconferência fora do recorte', () => {
    const fonte = extrairFuncao(script, 'montarLinhasVeredito');
    const reconstruida = new Function('return (' + fonte + ');')() as typeof montarLinhasVeredito;
    const chavesData = ['1441/2016'];
    const chavesReconferencia = ['500/2019'];
    const vereditos = { '1441/2016': 'fiel', '500/2019': 'errada' };
    expect(reconstruida(chavesData, chavesReconferencia, vereditos)).toEqual(
      montarLinhasVeredito(chavesData, chavesReconferencia, vereditos)
    );
  });
});
