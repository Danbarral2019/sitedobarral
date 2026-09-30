/**
 * Âncora por artigo no texto integral do ato (/legislacao/[id]#art-75), para
 * citar e compartilhar um dispositivo.
 *
 * Plugin remark: o parágrafo que abre com o rótulo do artigo em negrito
 * ("**Art. 75.**", como sai de `formatLegalContent`) recebe `id="art-75"`.
 * Só o texto do próprio ato: blocos :::alteracao e citações trazem artigos de
 * outra norma e ficam de fora. Rótulo repetido mantém a primeira âncora.
 */
import { visit, SKIP } from 'unist-util-visit';

const ROTULO = /^Art\s*\.\s*(\d+)\s*[ºo°]?(?:\s*-\s*([A-Z]))?/;

/** "Art. 75." → "art-75"; "Art. 184-A" → "art-184-a"; outro texto → null. */
export function idDoArtigo(rotulo: string): string | null {
  const m = rotulo.trim().match(ROTULO);
  if (!m) return null;
  return `art-${m[1]}${m[2] ? `-${m[2].toLowerCase()}` : ''}`;
}

/** "art-75" → "art. 75"; "art-1" → "art. 1º"; "art-184-a" → "art. 184-A". */
export function rotuloDoId(id: string): string {
  const m = id.match(/^art-(\d+)(?:-([a-z]))?$/);
  if (!m) return id;
  const n = Number(m[1]) < 10 ? `${m[1]}º` : m[1];
  return `art. ${n}${m[2] ? `-${m[2].toUpperCase()}` : ''}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textoInicial(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return node.children?.length ? textoInicial(node.children[0]) : '';
}

export function remarkAncorasDeArtigo() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    const usados = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, (node: any) => {
      if (node.type === 'blockquote' || (node.type === 'containerDirective' && node.name === 'alteracao')) {
        return SKIP;
      }
      if (node.type !== 'paragraph') return;
      const primeiro = node.children?.[0];
      if (primeiro?.type !== 'strong') return;
      const id = idDoArtigo(textoInicial(primeiro));
      if (!id || usados.has(id)) return;
      usados.add(id);
      const data = node.data || (node.data = {});
      data.hProperties = { ...(data.hProperties || {}), id };
    });
  };
}
