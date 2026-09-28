/**
 * Texto que vira vetor para uma tese (spec §9).
 *
 * O enunciado sozinho é uma frase de súmula: abstrata, curta e sem âncora no
 * precedente. Sem o prefixo, o retrieval perde o vínculo com o acórdão-líder
 * que a §9 quer preservar, e o leitor recebe afirmação sem procedência.
 *
 * O colegiado só entra quando é sabido (§4.3).
 */
export interface EntradaTexto {
  enunciado: string;
  assunto: string;
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  acordaoKey: string | null;
  origemIdentidade: string | null;
}

export function textoEmbeddavel(e: EntradaTexto): string {
  const linhas: string[] = [];

  const assunto = e.assunto?.trim();
  if (assunto) linhas.push(assunto);

  const colegiado = e.colegiadoAlvo?.trim();
  linhas.push(
    colegiado
      ? `Acórdão ${e.numeroAlvo}/${e.anoAlvo} — ${colegiado}`
      : `Acórdão ${e.numeroAlvo}/${e.anoAlvo}`,
  );

  return `${linhas.join('\n')}\n\n${e.enunciado.trim()}`;
}
