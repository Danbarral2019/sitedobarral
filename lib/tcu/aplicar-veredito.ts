/**
 * Resolve qual divergência o julgador marcou na folha de calibração.
 *
 * A folha identifica a divergência pela posição no card ("divergência 2"), e
 * `TeseDivergencia.ordem` é o campo que guarda essa posição — o mesmo papel que
 * `ordem` cumpre em `TeseEnunciado`. Resolver pelo campo, e não pela posição no
 * array devolvido pelo banco, é o que torna a gravação correta: uma consulta
 * sem `ORDER BY` pode devolver as linhas em qualquer ordem, e o julgamento leva
 * a assinatura do Daniel.
 *
 * Toda ambiguidade vira recusa explícita, nunca um palpite: o operador precisa
 * ver que aquele julgamento ficou de fora.
 */

export interface AlvoResolvido {
  id: string;
}

export interface AlvoRecusado {
  recusa: string;
}

export function resolverAlvoDivergencia(
  ordemAlvo: number,
  divergencias: ReadonlyArray<{ id: string; ordem: number }>
): AlvoResolvido | AlvoRecusado {
  const achadas = divergencias.filter((d) => d.ordem === ordemAlvo);

  if (achadas.length > 1) {
    return {
      recusa: `duas divergências gravadas com ordem ${ordemAlvo + 1} — dado inconsistente, não dá para saber qual foi julgada`,
    };
  }
  if (achadas.length === 0) {
    return { recusa: `a destilação não tem divergência de ordem ${ordemAlvo + 1} (tem ${divergencias.length})` };
  }
  return { id: achadas[0].id };
}
