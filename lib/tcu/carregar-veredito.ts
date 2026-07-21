/**
 * Decide se o veredito editorial de uma versão anterior acompanha um enunciado
 * para a versão nova (spec §2.3).
 *
 * A comparação é de igualdade EXATA de texto — sem normalizar espaços,
 * pontuação, acentuação ou caixa, e sem modelo. Normalizar seria decidir que
 * duas redações diferentes são a mesma tese, e esse julgamento é do Daniel,
 * não nosso. O custo assumido é que uma vírgula alterada devolve o enunciado
 * à fila; o erro inverso — carregar uma aprovação para um texto que ele não
 * leu — é inaceitável, porque a tese leva a assinatura dele.
 */

export interface EnunciadoJulgavel {
  id: string;
  enunciado: string;
  veredito: string | null;
}

export interface VeredictoHerdado {
  veredito: string | null;
  herdadoDe: string | null;
  julgadoEm: Date | null;
  julgadoPor: string | null;
}

const SEM_VEREDITO: VeredictoHerdado = {
  veredito: null,
  herdadoDe: null,
  julgadoEm: null,
  julgadoPor: null,
};

export function carregarVeredito(
  enunciadoNovo: string,
  anteriores: Array<EnunciadoJulgavel & { julgadoEm: Date | null; julgadoPor: string | null }>
): VeredictoHerdado {
  const par = anteriores.find((a) => a.veredito !== null && a.enunciado === enunciadoNovo);
  if (!par) return { ...SEM_VEREDITO };
  return {
    veredito: par.veredito,
    herdadoDe: par.id,
    julgadoEm: par.julgadoEm,
    julgadoPor: par.julgadoPor,
  };
}
