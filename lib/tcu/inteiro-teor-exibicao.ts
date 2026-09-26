/**
 * Prepara o inteiro teor de um acórdão do TCU (`Document.tcuTextoCompleto`,
 * convertido do RTF oficial) para leitura na página.
 *
 * O RTF traz, a cada folha, o cabeçalho "TRIBUNAL DE CONTAS DA UNIÃO<tab>TC
 * 039.458/2018-0" e o número da página numa linha própria. Isso some aqui.
 * Linhas curtas e todas em maiúsculas (RELATÓRIO, VOTO, ACÓRDÃO Nº 5890/2021 –
 * TCU – 2ª Câmara) viram títulos de seção, porque é por elas que o leitor se
 * orienta num texto de dezenas de páginas.
 */

/**
 * Espelho de `TETO_CHARS_CATALOGO` (lib/tcu/catalogar-acordao.ts): texto desse
 * tamanho foi cortado na gravação. Não se importa de lá porque aquele módulo
 * traz o Prisma, e este é usado também por componente de cliente.
 */
export const TETO_INTEIRO_TEOR = 500_000;

export interface BlocoInteiroTeor {
  tipo: 'titulo' | 'paragrafo';
  texto: string;
}

const CABECALHO_DE_FOLHA = /^TRIBUNAL DE CONTAS DA UNI[ÃA]O\s+TC[\s-]*[\d./-]+\s*$/i;
const NUMERO_DE_FOLHA = /^\d{1,4}$/;

function ehTitulo(linha: string): boolean {
  if (linha.length > 80) return false;
  const letras = linha.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras.length < 4) return false;
  return letras === letras.toUpperCase();
}

export function blocosDoInteiroTeor(texto: string): BlocoInteiroTeor[] {
  const blocos: BlocoInteiroTeor[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t+/g, ' ').replace(/ {2,}/g, ' ').trim();
    if (!linha || NUMERO_DE_FOLHA.test(linha) || CABECALHO_DE_FOLHA.test(bruta.trim())) continue;
    blocos.push({ tipo: ehTitulo(linha) ? 'titulo' : 'paragrafo', texto: linha });
  }
  return blocos;
}

export function inteiroTeorTruncado(texto: string): boolean {
  return texto.length >= TETO_INTEIRO_TEOR;
}
