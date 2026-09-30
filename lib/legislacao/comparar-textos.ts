/**
 * Comparação entre duas versões do texto integral de um ato normativo, por
 * dispositivo: cada parágrafo do texto (artigo, parágrafo, inciso, alínea) é
 * uma unidade. Diz o que foi incluído, suprimido ou alterado e, no alterado,
 * quais palavras mudaram.
 *
 * Mudança só de apresentação (espaços, quebra de parágrafo, negrito, aspas e
 * travessões tipográficos) não conta como alteração do texto: a página da
 * fonte oficial muda de marcação sem que a norma mude.
 */
import { idDoArtigo, rotuloDoId } from './ancoras';

export type Trecho = { tipo: 'igual' | 'incluido' | 'suprimido'; texto: string };

/** Artigo em que o dispositivo está, para situar a alteração e ligar à âncora. */
export type ArtigoDoDispositivo = { id: string; rotulo: string } | null;

export type Alteracao =
  | { tipo: 'incluido'; artigo: ArtigoDoDispositivo; depois: string }
  | { tipo: 'suprimido'; artigo: ArtigoDoDispositivo; antes: string }
  | { tipo: 'alterado'; artigo: ArtigoDoDispositivo; antes: string; depois: string; trechos: Trecho[] };

export interface Comparacao {
  alteracoes: Alteracao[];
  incluidos: number;
  suprimidos: number;
  alterados: number;
  /** O texto é o mesmo; mudou só a apresentação. */
  soFormatacao: boolean;
}

/** Acima disso (dispositivos × dispositivos), o miolo divergente não é alinhado. */
const LIMITE_ALINHAMENTO = 4_000_000;
/** O mesmo para palavras dentro de um dispositivo alterado. */
const LIMITE_PALAVRAS = 250_000;
/** Semelhança mínima (Dice sobre palavras) para tratar como o mesmo dispositivo alterado. */
const SEMELHANCA_MINIMA = 0.5;

/** Parágrafos do texto, com espaços e quebras de linha internas normalizados. */
export function dispositivos(texto: string | null | undefined): string[] {
  return (texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t ]*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Forma usada na comparação: sem negrito e com espaços, aspas e travessões uniformes. */
export function formaComparavel(texto: string): string {
  return texto
    .replace(/\*\*|__/g, '')
    .replace(/[    ]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

type Passo = { op: '='; i: number; j: number } | { op: '-'; i: number } | { op: '+'; j: number };

/**
 * Alinhamento pela maior subsequência comum. Prefixo e sufixo iguais saem
 * antes; o miolo só é alinhado se couber em `limite`, senão vira supressão
 * seguida de inclusão.
 */
function alinhar(a: string[], b: string[], limite: number): Passo[] {
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fimA = a.length;
  let fimB = b.length;
  while (fimA > ini && fimB > ini && a[fimA - 1] === b[fimB - 1]) {
    fimA--;
    fimB--;
  }

  const passos: Passo[] = [];
  for (let k = 0; k < ini; k++) passos.push({ op: '=', i: k, j: k });

  const n = fimA - ini;
  const m = fimB - ini;
  if (n * m > limite) {
    for (let i = ini; i < fimA; i++) passos.push({ op: '-', i });
    for (let j = ini; j < fimB; j++) passos.push({ op: '+', j });
  } else if (n > 0 || m > 0) {
    // lcs[i][j]: tamanho da subsequência comum de a[ini+i..] e b[ini+j..].
    const larg = m + 1;
    const lcs = new Uint32Array((n + 1) * larg);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * larg + j] =
          a[ini + i] === b[ini + j]
            ? lcs[(i + 1) * larg + j + 1] + 1
            : Math.max(lcs[(i + 1) * larg + j], lcs[i * larg + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[ini + i] === b[ini + j]) {
        passos.push({ op: '=', i: ini + i, j: ini + j });
        i++;
        j++;
      } else if (j < m && (i === n || lcs[i * larg + j + 1] >= lcs[(i + 1) * larg + j])) {
        passos.push({ op: '+', j: ini + j });
        j++;
      } else {
        passos.push({ op: '-', i: ini + i });
        i++;
      }
    }
  }

  for (let k = 0; k < a.length - fimA; k++) passos.push({ op: '=', i: fimA + k, j: fimB + k });
  return passos;
}

function palavras(texto: string): string[] {
  return formaComparavel(texto).toLowerCase().split(' ').filter(Boolean);
}

/** Coeficiente de Dice entre os conjuntos de palavras dos dois dispositivos. */
function semelhanca(a: string, b: string): number {
  const pa = new Set(palavras(a));
  const pb = new Set(palavras(b));
  if (pa.size === 0 && pb.size === 0) return 1;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return (2 * comuns) / (pa.size + pb.size);
}

/** Diferença palavra a palavra de um dispositivo alterado. */
export function trechosAlterados(antes: string, depois: string): Trecho[] {
  // Compara pela forma normalizada e exibe as palavras como estão no texto.
  const palavrasDe = (t: string) => t.replace(/\*\*|__/g, '').split(/\s+/).filter(Boolean);
  const a = palavrasDe(antes);
  const b = palavrasDe(depois);
  const ka = a.map(formaComparavel);
  const kb = b.map(formaComparavel);
  const trechos: Trecho[] = [];
  const empurrar = (tipo: Trecho['tipo'], texto: string) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.tipo === tipo) ultimo.texto += ` ${texto}`;
    else trechos.push({ tipo, texto });
  };
  // Em cada trecho divergente, o suprimido vem antes do incluído.
  let sup: string[] = [];
  let inc: string[] = [];
  const descarregar = () => {
    if (sup.length) empurrar('suprimido', sup.join(' '));
    if (inc.length) empurrar('incluido', inc.join(' '));
    sup = [];
    inc = [];
  };
  for (const p of alinhar(ka, kb, LIMITE_PALAVRAS)) {
    if (p.op === '-') sup.push(a[p.i]);
    else if (p.op === '+') inc.push(b[p.j]);
    else {
      descarregar();
      empurrar('igual', b[p.j]);
    }
  }
  descarregar();
  return trechos;
}

/** Artigo corrente em cada posição do texto (o último "Art. N" até ali). */
function artigosPorPosicao(ps: string[]): ArtigoDoDispositivo[] {
  let atual: ArtigoDoDispositivo = null;
  return ps.map((p) => {
    const id = idDoArtigo(p.replace(/\*\*/g, ''));
    if (id) atual = { id, rotulo: rotuloDoId(id) };
    return atual;
  });
}

export function compararTextos(antes: string | null | undefined, depois: string | null | undefined): Comparacao {
  const pa = dispositivos(antes);
  const pb = dispositivos(depois);
  const ca = pa.map(formaComparavel);
  const cb = pb.map(formaComparavel);

  if (ca.join(' ') === cb.join(' ')) {
    return { alteracoes: [], incluidos: 0, suprimidos: 0, alterados: 0, soFormatacao: true };
  }

  const artA = artigosPorPosicao(pa);
  const artB = artigosPorPosicao(pb);
  const alteracoes: Alteracao[] = [];

  // Cada bloco de supressões e inclusões entre dois dispositivos iguais: os
  // pares semelhantes, na ordem, são o mesmo dispositivo com nova redação.
  const fecharBloco = (sup: number[], inc: number[]) => {
    let s = 0;
    let k = 0;
    while (s < sup.length || k < inc.length) {
      if (s < sup.length && k < inc.length && semelhanca(pa[sup[s]], pb[inc[k]]) >= SEMELHANCA_MINIMA) {
        alteracoes.push({
          tipo: 'alterado',
          artigo: artB[inc[k]],
          antes: pa[sup[s]],
          depois: pb[inc[k]],
          trechos: trechosAlterados(pa[sup[s]], pb[inc[k]]),
        });
        s++;
        k++;
      } else if (s < sup.length && (k >= inc.length || sup.length - s >= inc.length - k)) {
        alteracoes.push({ tipo: 'suprimido', artigo: artA[sup[s]], antes: pa[sup[s]] });
        s++;
      } else {
        alteracoes.push({ tipo: 'incluido', artigo: artB[inc[k]], depois: pb[inc[k]] });
        k++;
      }
    }
  };

  let sup: number[] = [];
  let inc: number[] = [];
  for (const p of alinhar(ca, cb, LIMITE_ALINHAMENTO)) {
    if (p.op === '-') sup.push(p.i);
    else if (p.op === '+') inc.push(p.j);
    else if (sup.length || inc.length) {
      fecharBloco(sup, inc);
      sup = [];
      inc = [];
    }
  }
  if (sup.length || inc.length) fecharBloco(sup, inc);

  return {
    alteracoes,
    incluidos: alteracoes.filter((x) => x.tipo === 'incluido').length,
    suprimidos: alteracoes.filter((x) => x.tipo === 'suprimido').length,
    alterados: alteracoes.filter((x) => x.tipo === 'alterado').length,
    soFormatacao: false,
  };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "2 dispositivos alterados e 1 incluído"; "só formatação". */
export function resumoDaComparacao(c: Comparacao): string {
  if (c.soFormatacao) return 'Só apresentação; o texto é o mesmo';
  const partes = [
    c.alterados ? plural(c.alterados, 'dispositivo alterado', 'dispositivos alterados') : '',
    c.incluidos ? plural(c.incluidos, 'incluído', 'incluídos') : '',
    c.suprimidos ? plural(c.suprimidos, 'suprimido', 'suprimidos') : '',
  ].filter(Boolean);
  if (partes.length === 0) return 'Sem alteração de dispositivos';
  // "1 incluído" sozinho precisa do substantivo.
  if (!c.alterados) partes[0] = partes[0].replace(/^(\d+) /, (_, n) => `${n} ${Number(n) === 1 ? 'dispositivo' : 'dispositivos'} `);
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}
