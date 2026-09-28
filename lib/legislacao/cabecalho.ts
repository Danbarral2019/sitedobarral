/**
 * Dados do cabeçalho da página de ato normativo (`/legislacao/[id]`), extraídos
 * do cadastro sem inventar nada: o que não se confirma no próprio texto do ato
 * não aparece.
 */
import { isIdentificacaoDoAto } from '@/lib/legislative-scrapers/extract-ementa';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Subtítulo exibido sob o número do ato. O campo `title` guarda ora um nome
 * descritivo ("Credenciamento para Contratação..."), ora a própria epígrafe
 * ("DECRETO Nº 11.345, DE 1º DE JANEIRO DE 2023"), que repetiria o número.
 * Epígrafe seguida de apelido ("Lei nº 10.973, de 2004 — Lei da Inovação")
 * fica só com o apelido.
 */
export function subtituloDoAto(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = collapse(title);
  if (!t || isIdentificacaoDoAto(t)) return null;
  // Identificação com data ("Lei 10.522/2002, de 19 de julho de 2002") seguida
  // ou não de apelido entre parênteses ou após travessão.
  const id = t.match(
    /^((?:lei|decreto|portaria|in|instru[çc][ãa]o|resolu[çc][ãa]o|mp|medida|ordem|orienta[çc][ãa]o)\b.*?\bde\s+\d{1,2}[ºo°]?\s+de\s+[a-zç]+\s+de\s+\d{4})\.?\s*(?:\((.+)\)|[—–-]\s+(.+))?$/i,
  );
  if (id) return id[2] ?? id[3] ?? null;
  // Epígrafe truncada no cadastro ("DECRETO Nº 1.819, DE 16 DE FEVEREIRO DE"):
  // tipo seguido de "nº" e número também só identifica o ato.
  if (/^(?:lei|decreto(?:-lei)?|portaria|instru[çc][ãa]o normativa|resolu[çc][ãa]o|medida provis[óo]ria|in|mp)\b[^()—–]{0,40}?\bn\.?\s*[ºo°]\.?\s*[\d.]+/i.test(t) && !/[()—–]/.test(t)) {
    return null;
  }
  return t;
}

/**
 * Data de assinatura lida da epígrafe do próprio ato ("..., DE 21 DE JUNHO DE
 * 2023"). Só vale a epígrafe com o número do ato, para não pegar a data de
 * outro ato citado no texto. Procura no título e no começo do texto integral.
 */
export function dataDoAto(
  numero: string | null | undefined,
  fontes: Array<string | null | undefined>,
): Date | null {
  const proprio = (numero ?? '').replace(/\D/g, '');
  if (!proprio) return null;
  const re = /n\.?\s*[ºo°]?\.?\s*([\d.]+)\s*,?\s+de\s+(\d{1,2})[ºo°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/gi;
  for (const fonte of fontes) {
    if (!fonte) continue;
    const trecho = collapse(fonte.slice(0, 3000));
    for (const m of trecho.matchAll(re)) {
      if (m[1].replace(/\D/g, '') !== proprio) continue;
      const mes = MESES.indexOf(m[3].toLowerCase());
      const dia = Number(m[2]);
      if (mes < 0 || dia < 1 || dia > 31) continue;
      return new Date(Date.UTC(Number(m[4]), mes, dia));
    }
  }
  return null;
}

/** "1º de janeiro de 2023", "21 de junho de 2023" (datas gravadas em UTC). */
export function dataPorExtenso(date: Date | string): string {
  const d = new Date(date);
  const dia = d.getUTCDate();
  return `${dia === 1 ? '1º' : dia} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function diaUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Data de publicação que merece exibição, ou null. O `publishDate` do cadastro
 * não é confiável fora do clipping do DOU: há 1º de janeiro como preenchimento
 * de ano, datas anteriores à assinatura e datas que divergem do rodapé do
 * próprio texto ("DOU de 23/06/2023" com cadastro em 30 de junho). Ordem:
 * 1. a data que o texto declara ("publicado no DOU de 24.7.1991");
 * 2. o `publishDate` de ato baixado do DOU (in.gov.br).
 * Publicação no mesmo dia do ato, antes dele ou mais de 60 dias depois é
 * omitida (no primeiro caso seria repetição; nos outros, dado suspeito).
 */
export function dataDePublicacao(
  act: { publishDate: Date | string; officialUrl?: string | null; content?: string | null },
  ato: Date | null,
): Date | null {
  let pub: Date | null = null;
  const doTexto = act.content?.match(/\bD\.?\s?O\.?\s?U\.?\s+de\s+(\d{1,2})[./](\d{1,2})[./](\d{4})/i);
  if (doTexto) {
    pub = new Date(Date.UTC(Number(doTexto[3]), Number(doTexto[2]) - 1, Number(doTexto[1])));
  } else if (act.officialUrl && /in\.gov\.br/i.test(act.officialUrl)) {
    pub = new Date(act.publishDate);
  }
  if (!pub || Number.isNaN(pub.getTime())) return null;
  if (!ato) return pub;
  const dias = (diaUTC(pub) - diaUTC(ato)) / 86_400_000;
  return dias > 0 && dias <= 60 ? pub : null;
}

export function mesmoDia(a: Date | string, b: Date | string): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

/** Órgão emissor para exibição; "Outro" e vazio não informam nada. */
export function orgaoEmissor(issuer: string | null | undefined): string | null {
  const t = collapse(issuer ?? '');
  if (!t || /^(outro|não informado)$/i.test(t)) return null;
  if (/^presidência$/i.test(t)) return 'Presidência da República';
  return t;
}

/** "Art. 1º" a "Art. 9º" com ordinal; do 10 em diante, cardinal ("Art. 75"). */
export function rotuloArtigo(numero: string): string {
  const n = numero.trim();
  const m = n.match(/^([1-9])(-[A-Z])?$/i);
  return m ? `Art. ${m[1]}º${(m[2] ?? '').toUpperCase()}` : `Art. ${n}`;
}

/**
 * A ementa já aparece no texto integral? Nesse caso o bloco "Ementa" repetiria
 * o parágrafo logo abaixo do título do ato.
 */
export function ementaNoTexto(ementa: string, content: string | null | undefined): boolean {
  if (!content) return false;
  const inicio = collapse(ementa).slice(0, 80).toLowerCase();
  if (inicio.length < 20) return false;
  return collapse(content.slice(0, 8000)).toLowerCase().includes(inicio);
}
