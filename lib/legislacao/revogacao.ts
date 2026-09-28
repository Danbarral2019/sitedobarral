/**
 * Leitura da nota de revogação ("Revogado pelo Decreto nº 11.531, de 2023")
 * para localizar o ato revogador na base e ligar o aviso a ele.
 */

const TIPOS: Array<[RegExp, string]> = [
  [/^medida provis[óo]ria$/i, 'medida-provisoria'],
  [/^decreto-lei$/i, 'decreto-lei'],
  [/^lei complementar$/i, 'lei-complementar'],
  [/^decreto$/i, 'decreto'],
  [/^lei$/i, 'lei'],
  [/^portaria$/i, 'portaria'],
  [/^instru[çc][ãa]o normativa$/i, 'in'],
];

export interface ReferenciaAto {
  tipo: string;
  numero: string;
  ano: number;
}

export function referenciaDoRevogador(nota: string | null | undefined): ReferenciaAto | null {
  if (!nota) return null;
  const m = nota.match(
    /revogad[oa]\s+pel[oa]\s+(medida provis[óo]ria|decreto-lei|lei complementar|decreto|lei|portaria|instru[çc][ãa]o normativa)\s+n\.?\s*[ºo°]?\s*([\d.]+)\s*,\s*de\s+(?:\d{1,2}[ºo°]?\s+de\s+[a-zç]+\s+de\s+)?(\d{4})/i,
  );
  if (!m) return null;
  const tipo = TIPOS.find(([re]) => re.test(m[1]))?.[1];
  if (!tipo) return null;
  return { tipo, numero: m[2], ano: Number(m[3]) };
}
