/**
 * Paleta da casa em hexadecimal, para uso nos e-mails.
 *
 * Por que um módulo separado, e não os tokens de app/globals.css: cliente de
 * e-mail não resolve `var(--cor)`. O Outlook ignora custom properties, e o
 * Gmail remove `:root`. Em e-mail, cor é hexadecimal literal escrito inline —
 * então a única forma de ter uma fonte de verdade é esta constante, importada
 * por todos os templates.
 *
 * Os valores espelham `app/globals.css`. Ao mudar um lá, mude aqui.
 *
 * Um teste-guarda (`__tests__/paleta.test.ts`) varre os módulos de e-mail e
 * falha se aparecer hexadecimal fora desta lista. É o que impede o próximo
 * e-mail de nascer com o azul padrão do Tailwind, como os 23 anteriores.
 */

export const EMAIL_COLOR = {
  /** Petróleo. Cabeçalho, botões primários, títulos de destaque. */
  petroleo: '#20364e',
  /** Petróleo escuro. Rodapé e estados de hover. */
  petroleoEscuro: '#142230',
  /** Petróleo claro. Texto secundário sobre fundo petróleo. */
  petroleoClaro: '#3a5a73',

  /** Fundo da página. Off-white — nunca #ffffff puro no corpo. */
  fundo: '#fdfdfb',
  /** Superfície elevada: cartões e blocos dentro do corpo. */
  superficie: '#f7f6f3',
  /** Superfície profunda: separadores de seção, faixas. */
  profunda: '#eeeae4',

  /** Tinta principal. Substitui os cinzas escuros do Tailwind. */
  tinta: '#1a1c20',
  /** Tinta secundária: texto descritivo. */
  tintaSecundaria: '#3d4044',
  /** Metadados, datas, contagens, texto de rodapé. */
  metadado: '#6b6e72',

  /** Divisor de 1px. */
  divisor: '#e8e6e1',
  /** Borda forte: hover e separador de peso. */
  bordaForte: '#cdcac4',

  /** Âmbar. Só em referência a fonte oficial — nunca em CTA. */
  ambar: '#b07d3a',
  /** Âmbar profundo: texto âmbar sobre fundo claro, com contraste AA. */
  ambarProfundo: '#8a6235',
  /** Âmbar suave: fundo de marcador de fonte. */
  ambarSuave: '#e9d8b8',

  /** Branco puro. Só para texto sobre petróleo, nunca como fundo de corpo. */
  branco: '#ffffff',
} as const;

/**
 * Todos os hexadecimais autorizados, em minúsculas. O teste-guarda usa isto.
 */
export const PALETA_EMAIL: readonly string[] = Object.freeze(
  Object.values(EMAIL_COLOR).map((c) => c.toLowerCase()),
);

/**
 * Famílias tipográficas. Serif para título, sans para corpo — as mesmas do
 * site, com as pilhas de fallback que clientes de e-mail entendem.
 */
export const EMAIL_FONT = {
  titulo: "Georgia,'Times New Roman',serif",
  corpo: "Arial,Helvetica,sans-serif",
  mono: "'Courier New',Courier,monospace",
} as const;
