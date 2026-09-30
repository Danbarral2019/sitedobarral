/**
 * Leitura da cláusula de vigência do texto de um ato normativo ("Este Decreto
 * entra em vigor na data de sua publicação") e cálculo da data de vigência.
 *
 * Só se calcula o que o texto permite afirmar: data expressa, vigência na
 * publicação ou vacância em dias. Vigência escalonada, com exceções ou em
 * meses e anos fica para leitura humana.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const POR_EXTENSO: Record<string, number> = {
  um: 1, dois: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5, sete: 7, dez: 10, quinze: 15,
  vinte: 20, trinta: 30, quarenta: 40, 'quarenta e cinco': 45, sessenta: 60, noventa: 90,
  'cento e vinte': 120, 'cento e oitenta': 180,
};

const SUJEITO = String.raw`(?:Est[ea]s?|A presente|O presente)\s+(?:Lei(?: Complementar)?|Decreto(?:-Lei)?|Instru[çc][ãa]o(?: Normativa)?|IN|C[óo]digo|Portaria(?: Conjunta| Normativa)?|Resolu[çc][ãa]o|Medida Provis[óo]ria|Ordem de Servi[çc]o|norma|ato)`;
// "entre em vigor" aparece por erro de digitação em portarias; vale como cláusula.
const CLAUSULA = new RegExp(
  SUJEITO + String.raw`\s+(?:entra(?:r[áa])?|entram|entrar[aã]o|entre)\s+em\s+vigor([^.;]{0,200})`,
  'giu',
);

const EXCECOES =
  /\bI\s*[-–]|:\s*(?:\(|$)|quanto a|em rela[çc][ãa]o a|exceto|salvo|ressalvad|produzi(?:ndo|rá) efeitos|observado o disposto/i;

export interface Clausula {
  /** Trecho da cláusula, como está no texto. */
  texto: string;
  /** O que vem depois de "entra em vigor". */
  resto: string;
  /** O texto tem mais de uma cláusula (parágrafo com regra própria, texto citado). */
  multiplas: boolean;
}

/**
 * Cláusula de vigência do ato. Havendo mais de uma, vale a que abre com
 * maiúscula ("Esta Lei entra em vigor..."), que é o caput do artigo; as de
 * parágrafo ("§ 1º ... esta Lei entra em vigor ...") ficam em segundo plano.
 */
export function clausulaDeVigencia(content: string | null | undefined): Clausula | null {
  const c = (content ?? '').replace(/\s+/g, ' ');
  const ms = [...c.matchAll(CLAUSULA)];
  if (ms.length === 0) return null;
  const m = ms.find((x) => /^E/.test(x[0].trim())) ?? ms[0];
  return { texto: m[0].trim(), resto: m[1].trim(), multiplas: ms.length > 1 };
}

export type Regra =
  | { tipo: 'data'; data: Date }
  | { tipo: 'publicacao' }
  | { tipo: 'vacancia'; dias: number }
  | { tipo: 'especial' };

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Regra de vigência expressa no restante da cláusula. */
export function regraDeVigencia(resto: string): Regra {
  if (EXCECOES.test(resto)) return { tipo: 'especial' };
  const data = resto.match(/^(?:em|no dia|a partir de)?\s*(\d{1,2})[ºo°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (data && MESES.includes(data[2].toLowerCase())) {
    return { tipo: 'data', data: utc(Number(data[3]), MESES.indexOf(data[2].toLowerCase()), Number(data[1])) };
  }
  if (
    /^(?:na|a partir da) data (?:de |da )?(?:sua )?publica[çc][ãa]o(?: no Di[áa]rio Oficial da Uni[ãa]o)?\s*(?:,\s*revogad[ao]s? as disposi[çc][õo]es em contr[áa]rio.*)?$/i.test(
      resto,
    )
  ) {
    return { tipo: 'publicacao' };
  }
  const vac = resto.match(
    /^(?:ap[óo]s decorridos|decorridos|no prazo de)?\s*(\d+|[a-zçê ]+?)\s*(?:\([a-zçê ]+\)\s*)?dias\s*(?:,\s*)?(?:ap[óo]s|de|da|a partir da|contados da)?\s*(?:a\s+)?(?:data\s+)?(?:de\s+|da\s+)?(?:sua\s+)?publica[çc][ãa]o(?: oficial)?\s*$/i,
  );
  if (vac) {
    const dias = /^\d+$/.test(vac[1]) ? Number(vac[1]) : POR_EXTENSO[vac[1].trim().toLowerCase()];
    if (dias) return { tipo: 'vacancia', dias };
  }
  return { tipo: 'especial' };
}

/**
 * Data de publicação registrada no próprio texto ("DOU de 22.6.1993",
 * "D.O.U. nº 220, de 14/11/2012", "DOU de 6 de dezembro de 2024"). Só vale a
 * que cai entre a data do ato e 60 dias depois dela: fora disso, é a
 * publicação de outro ato citado no texto.
 */
export function publicacaoNoTexto(content: string | null | undefined, dataDoAto: Date | null): Date | null {
  if (!dataDoAto) return null;
  const c = (content ?? '').replace(/\s+/g, ' ');
  const re =
    /\bD\.?\s?O\.?\s?U\.?(?:\s*,)?(?:\s*(?:n[ºo°.]?\s*\d+|se[çc][ãa]o\s+\w+|parte\s+\w+)\s*,?)*\s*,?\s*(?:de|em)\s+(?:(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})|(\d{1,2})[ºo°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4}))/gi;
  for (const m of c.matchAll(re)) {
    let d: Date;
    if (m[1]) {
      let y = Number(m[3]);
      if (y < 100) y += y < 50 ? 2000 : 1900;
      d = utc(y, Number(m[2]) - 1, Number(m[1]));
    } else {
      const mi = MESES.indexOf(m[5].toLowerCase());
      if (mi < 0) continue;
      d = utc(Number(m[6]), mi, Number(m[4]));
    }
    if (dentroDaJanela(d, dataDoAto)) return d;
  }
  return null;
}

/** Publicação plausível para o ato: no mesmo dia ou até 60 dias depois. */
export function dentroDaJanela(publicacao: Date, dataDoAto: Date): boolean {
  const dias = (publicacao.getTime() - dataDoAto.getTime()) / 86_400_000;
  return dias >= 0 && dias <= 60;
}

/**
 * Vigência após vacância em dias, pela Lei Complementar nº 95, de 1998, art.
 * 8º, § 1º: o prazo inclui o dia da publicação e o último dia, e a lei entra em
 * vigor no dia seguinte ao fim do prazo. Publicação em 23 de janeiro com 30
 * dias de vacância: o prazo vai até 21 de fevereiro; vigência em 22.
 */
export function vigenciaAposVacancia(publicacao: Date, dias: number): Date {
  return new Date(publicacao.getTime() + dias * 86_400_000);
}

/** Vigência a partir da regra e da data de publicação; null se não der. */
export function calcularVigencia(regra: Regra, publicacao: Date | null): Date | null {
  if (regra.tipo === 'data') return regra.data;
  if (!publicacao) return null;
  if (regra.tipo === 'publicacao') return publicacao;
  if (regra.tipo === 'vacancia') return vigenciaAposVacancia(publicacao, regra.dias);
  return null;
}

/** Palavra que o título do DOU traz para cada tipo de ato. */
const PALAVRA_DO_TIPO: Record<string, string> = {
  in: 'instrucao normativa',
  decreto: 'decreto',
  'decreto-lei': 'decreto-lei',
  portaria: 'portaria',
  resolucao: 'resolucao',
  lei: 'lei',
  'lei-complementar': 'lei complementar',
  'medida-provisoria': 'medida provisoria',
};

export function palavraDoTipo(tipo: string): string | undefined {
  return PALAVRA_DO_TIPO[tipo];
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[º°]/g, 'o').toLowerCase().replace(/\s+/g, ' ');

/**
 * O resultado da busca do DOU é o próprio ato? Título com o tipo, o número e
 * o ano ("INSTRUÇÃO NORMATIVA SEGES/ME Nº 67, DE 8 DE JULHO DE 2021", ou no
 * formato antigo "No- 2"). Retificação fica de fora: a vigência corre da
 * publicação original.
 */
export function tituloDoDouEDoAto(
  titulo: string,
  resumo: string,
  tipo: string,
  numero: string,
  ano: number,
): boolean {
  const t = normalizar(titulo);
  const palavra = PALAVRA_DO_TIPO[tipo];
  if (palavra && !t.includes(palavra)) return false;
  if (/retifica/.test(t) || /^retifica/.test(normalizar(resumo))) return false;
  const numeros = [...t.matchAll(/\bn\.?\s*o?[\s.-]*(\d[\d.]*)/g)].map((m) => m[1].replace(/\./g, ''));
  return numeros.includes(numero.replace(/\./g, '')) && t.includes(String(ano));
}
