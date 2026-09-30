/**
 * Endereço canônico de um artigo da Lei 14.133/2021.
 *
 * Módulo leve, sem o texto da lei, para poder ser importado por componentes
 * de cliente. /artigo/N continua existindo só como redirecionamento
 * permanente para este endereço; os links internos apontam direto para cá.
 */
export function urlDoArtigo(numero: string | number): string {
  return `/lei-14133?artigo=${encodeURIComponent(String(numero))}`;
}
