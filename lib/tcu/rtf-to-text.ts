/**
 * RTF → texto limpo. Usado para o inteiro teor dos acórdãos do TCU, que o
 * Tribunal serve em RTF (apesar de o campo se chamar `tcuLinkPDF`).
 *
 * Biblioteca escolhida no spike de 15/07 (ver §4.4 do design):
 * `rtf-stream-parser` só lê RTF encapsulado de e-mail; `unrtf` é wrapper de
 * binário do SO e não roda na Vercel. `rtf-parser` funciona — mas devolve o
 * dump hexadecimal das imagens embutidas como se fosse texto (134.824 chars
 * com lixo vs. 72.087 limpos), daí o filtro abaixo.
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import * as rtfParser from 'rtf-parser';

/** Parágrafo que é dump hexadecimal de imagem (EMF/WMF), não texto. */
function ehDumpBinario(s: string): boolean {
  const t = s.trim();
  if (t.length < 80) return false; // texto curto com hex é legítimo (ex.: nº de processo)
  const hex = (t.match(/[0-9a-f]/gi) ?? []).length;
  return hex / t.length > 0.92;
}

export async function rtfToText(buf: Buffer): Promise<string> {
  // O RTF do TCU é cp1252; latin1 preserva os bytes para a lib decodificar \'hh.
  const rtf = buf.toString('latin1');

  // rtf-parser não valida o formato: para entrada sem cabeçalho RTF, ele
  // devolve doc.content com o texto cru (sem erro), o que mascararia um
  // arquivo corrompido como "extração bem-sucedida vazia". Validamos aqui.
  if (!rtf.trimStart().startsWith('{\\rtf')) {
    throw new Error('RTF inválido: arquivo não começa com {\\rtf');
  }

  const doc = await new Promise<{ content: Array<{ content?: Array<{ value?: string }> }> }>(
    (resolve, reject) => {
      rtfParser.string(rtf, (err, d) => (err ? reject(err) : resolve(d)));
    }
  );

  return doc.content
    .map((p) => (p.content ?? []).map((s) => s.value ?? '').join(''))
    .filter((p) => !ehDumpBinario(p))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
