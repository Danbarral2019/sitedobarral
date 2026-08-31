/**
 * Corte de texto para amostra pública (ementa de documento restrito, resposta
 * de IA para quem não assinou).
 *
 * O corte é por sentido, não por contagem: prefere o fim da última frase que
 * cabe, cai para o último espaço quando não há pontuação, e nunca parte
 * palavra. Quem lê deve perceber que o texto continua — não que ele quebrou.
 */

export interface Amostra {
  trecho: string;
  cortado: boolean;
}

/** Pontuação que não deve sobrar pendurada no fim de um trecho cortado. */
const SOBRA_NO_FIM = /[\s,;:\-–—]+$/;

export function trechoDeAmostra(texto: string, limite: number): Amostra {
  const limpo = texto.trim();

  if (limpo.length === 0) {
    return { trecho: '', cortado: false };
  }

  if (limpo.length <= limite) {
    return { trecho: limpo, cortado: false };
  }

  const janela = limpo.slice(0, limite);

  // 1ª escolha: fim da última frase completa dentro da janela.
  const frases = [...janela.matchAll(/[.!?…](?=\s|$)/g)];
  const ultimaFrase = frases.at(-1);

  if (ultimaFrase?.index !== undefined) {
    return {
      trecho: janela.slice(0, ultimaFrase.index + 1).trim(),
      cortado: true,
    };
  }

  // 2ª escolha: último espaço, para não partir palavra.
  const ultimoEspaco = janela.lastIndexOf(' ');
  const bruto = ultimoEspaco > 0 ? janela.slice(0, ultimoEspaco) : janela;

  return {
    trecho: bruto.replace(SOBRA_NO_FIM, ''),
    cortado: true,
  };
}
