/**
 * Recorte de teses visível a um leitor (spec §9).
 *
 * A regra depende do leitor, não da rota: quem tem acesso ativo (matrícula
 * válida, assinatura ou admin, como em `app/(acervo)/teses/[chave]/acesso.ts`)
 * vê o acervo onde estiver; os demais, só a vitrine. Módulo próprio porque a
 * mesma regra vai valer para `/api/documents/query` quando as teses forem
 * ligadas no assistente, e regra duplicada é regra que diverge.
 */
export function visibilidadeDasTeses(temAcessoAtivo: boolean): 'vitrine' | 'acervo' {
  return temAcessoAtivo ? 'acervo' : 'vitrine';
}
