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
  publicado: boolean;
  vitrinePublica: boolean;
  retiradoEm: Date | null;
  retiradoMotivo: string | null;
  /**
   * Veredito herdado de uma versão cujo TEXTO ERA DIFERENTE (spec §4.1, nível
   * 2). Vale para o acervo restrito, nunca para a vitrine, e some quando o
   * enunciado é conferido de novo.
   */
  reconferenciaPendente: boolean;
}

export interface OpcoesHeranca {
  /**
   * Liga o nível 2. Default `false`: nenhum chamador muda de comportamento sem
   * pedir — e as divergências, que não têm onde guardar a pendência, ficam de
   * fora por isso (ver persistir-tese.ts).
   */
  herdarComTextoDiferente?: boolean;
}

const SEM_VEREDITO: VeredictoHerdado = {
  veredito: null,
  herdadoDe: null,
  julgadoEm: null,
  julgadoPor: null,
  publicado: false,
  vitrinePublica: false,
  retiradoEm: null,
  retiradoMotivo: null,
  reconferenciaPendente: false,
};

export function carregarVeredito(
  enunciadoNovo: string,
  anteriores: Array<EnunciadoJulgavel & {
    julgadoEm: Date | null;
    julgadoPor: string | null;
    publicado?: boolean;
    vitrinePublica?: boolean;
    retiradoEm?: Date | null;
    retiradoMotivo?: string | null;
  }>,
  opcoes: OpcoesHeranca = {}
): VeredictoHerdado {
  const parEditorial = anteriores.find((a) => a.enunciado === enunciadoNovo);

  // ---- Nível 1: texto idêntico. Comportamento inalterado. ----
  if (parEditorial) {
    // DOIS pareamentos, porque os dois eixos da spec §5 têm condições diferentes.
    //
    // O estado editorial (publicado/vitrine/retirada) é preso ao TEXTO IDÊNTICO,
    // e só a ele: a retirada é um ato de quem tirou a tese do ar, e vale enquanto
    // o texto for o mesmo — julgada ou não. Acoplá-la à existência de veredito
    // deixava um buraco real: `retirar-teses.ts` retira todo enunciado da chave,
    // inclusive os que ainda não têm veredito; sem par, o retorno era
    // SEM_VEREDITO, que ZERA `retiradoEm` — e a redestilação do alvo ressuscitava
    // a tese retirada, exatamente o que a §5 declara impossível.
    //
    // O veredito (e herdadoDe/julgadoEm/julgadoPor) continua exigindo um
    // anterior JULGADO. Os dois `find` são separados — em vez de checar o
    // veredito do par editorial — para não perder esse veredito quando há dois
    // anteriores com o mesmo texto e só o segundo foi julgado: nesse caso o
    // veredito ainda é herdado do segundo.
    //
    // Essa garantia é só do veredito. Os quatro campos editoriais
    // (publicado/vitrinePublica/retiradoEm/retiradoMotivo) sempre vêm de
    // `parEditorial` — o PRIMEIRO anterior que casar por texto, julgado ou não
    // — mesmo quando é o segundo que carrega o veredito. Havendo duplicatas com
    // o mesmo texto, qual delas é "o primeiro" é indefinido: a consulta que
    // monta `anteriores` (`persistir-tese.ts`, por volta da linha 172) não tem
    // `orderBy`, então o estado editorial herdado nesse caso depende da ordem
    // em que o Postgres devolver as linhas.
    const par = anteriores.find((a) => a.veredito !== null && a.enunciado === enunciadoNovo);
    return {
      veredito: par?.veredito ?? null,
      herdadoDe: par?.id ?? null,
      julgadoEm: par?.julgadoEm ?? null,
      julgadoPor: par?.julgadoPor ?? null,
      publicado: parEditorial.publicado ?? false,
      vitrinePublica: parEditorial.vitrinePublica ?? false,
      retiradoEm: parEditorial.retiradoEm ?? null,
      retiradoMotivo: parEditorial.retiradoMotivo ?? null,
      reconferenciaPendente: false,
    };
  }

  // ---- Nível 2: texto diferente (spec §4.1). ----
  //
  // Só entra quando o chamador pede. Sem isto, o default seria uma mudança de
  // comportamento para todo mundo que chama a função — inclusive as
  // divergências, que não têm coluna onde marcar a pendência e ficariam com
  // veredito provisório invisível.
  if (!opcoes.herdarComTextoDiferente) return { ...SEM_VEREDITO };

  // A retirada é ato de quem tirou a tese do ar, e vale para o acórdão, não
  // para a redação. Sem esta linha, mudar o texto ressuscita tese retirada.
  const retirado = anteriores.find((a) => a.retiradoEm != null);
  const retirada = {
    retiradoEm: retirado?.retiradoEm ?? null,
    retiradoMotivo: retirado?.retiradoMotivo ?? null,
  };

  const julgados = anteriores.filter((a) => a.veredito !== null);
  if (julgados.length === 0) return { ...SEM_VEREDITO, ...retirada };

  // Sem pareamento por texto (spec §4.2), a versão anterior precisa falar com
  // uma voz só. Vereditos divergentes não dão o que herdar sem adivinhar.
  const distintos = new Set(julgados.map((j) => j.veredito));
  if (distintos.size > 1) return { ...SEM_VEREDITO, ...retirada };

  const origem = julgados[0];
  return {
    veredito: origem.veredito,
    herdadoDe: origem.id,
    julgadoEm: null,
    julgadoPor: null,
    publicado: origem.publicado ?? false,
    vitrinePublica: false,
    ...retirada,
    reconferenciaPendente: true,
  };
}
