/**
 * Prepara o inteiro teor de um acórdão do TCU (`Document.tcuTextoCompleto`,
 * convertido do RTF oficial) para leitura na página.
 *
 * O RTF traz, a cada folha, o cabeçalho "TRIBUNAL DE CONTAS DA UNIÃO<tab>TC
 * 039.458/2018-0" e o número da página numa linha própria. Isso some aqui.
 * Linhas curtas e todas em maiúsculas (RELATÓRIO, VOTO, ACÓRDÃO Nº 5890/2021 –
 * TCU – 2ª Câmara) viram títulos de seção, porque é por elas que o leitor se
 * orienta num texto de dezenas de páginas.
 *
 * Serve também ao texto integral dos pareceres da AGU (`Document.textoIntegral`),
 * que chega aqui já com um parágrafo por linha (lib/agu/inteiro-teor-decor.ts
 * junta as linhas do PDF e tira os marcadores de página na gravação).
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

// ─────────────────────────────────────────────────────────────────────────────
// Qual inteiro teor a página mostra
// ─────────────────────────────────────────────────────────────────────────────

export interface InteiroTeorParaExibir {
  texto: string;
  /** Subtítulo da seção recolhida "Inteiro teor". */
  subtitulo: string;
  /** Início do aviso de texto cortado, com a concordância certa ("Este acórdão é longo demais"). */
  avisoLongo: string;
  /** Transcrição por OCR de PDF digitalizado: a página avisa que pode ter erros. */
  ocr?: boolean;
}

/** Artigo + nome do documento de fonte externa, pela categoria. */
function nomeDoDocumento(category: string): { subtitulo: string; avisoLongo: string } {
  switch (category) {
    case 'nota-tecnica':
      return { subtitulo: 'Texto integral da nota técnica', avisoLongo: 'Esta nota técnica é longa demais' };
    case 'despacho':
      return { subtitulo: 'Texto integral do despacho', avisoLongo: 'Este despacho é longo demais' };
    case 'parecer':
    case 'parecer-vinculante':
    case 'decor':
      return { subtitulo: 'Texto integral do parecer', avisoLongo: 'Este parecer é longo demais' };
    default:
      return { subtitulo: 'Texto integral', avisoLongo: 'Este documento é longo demais' };
  }
}

/**
 * Escolhe o inteiro teor que a página /documento/[id] mostra:
 *  1. `tcuTextoCompleto` — acórdão do TCU (relatório, voto e acórdão);
 *  2. `textoIntegral`    — documento de fonte externa (hoje, parecer da AGU em
 *     PDF público do DECOR, gravado por lib/agu/inteiro-teor-decor.ts).
 * Devolve null quando não há nenhum dos dois. Quem decide se o leitor PODE
 * ver é a página (`temAcesso`), não esta função.
 */
export function escolherInteiroTeor(doc: {
  category: string;
  tcuTextoCompleto?: string | null;
  textoIntegral?: string | null;
  textoIntegralOcr?: boolean | null;
}): InteiroTeorParaExibir | null {
  if (doc.tcuTextoCompleto && doc.tcuTextoCompleto.trim()) {
    return { texto: doc.tcuTextoCompleto, subtitulo: 'Relatório, voto e acórdão', avisoLongo: 'Este acórdão é longo demais' };
  }
  if (doc.textoIntegral && doc.textoIntegral.trim()) {
    return { texto: doc.textoIntegral, ...nomeDoDocumento(doc.category), ocr: !!doc.textoIntegralOcr };
  }
  return null;
}
