/**
 * Conversor markdown -> HTML simples para preview do editor de licao.
 *
 * NAO sanitiza HTML (apenas transforma sintaxe markdown comum). O caller
 * usa dangerouslySetInnerHTML aceitando input do admin como confiavel.
 *
 * Suporta: h1/h2/h3, **bold**, *italic*, listas com -, quebras de linha.
 */

export function simpleMarkdownToHtml(md: string): string {
  let html = md;

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc my-2">$&</ul>');

  html = html.replace(/\n/g, '<br/>');

  return html;
}
