import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkDirective from 'remark-directive';
import { idDoArtigo, rotuloDoId, remarkAncorasDeArtigo } from '../ancoras';

const html = (md: string) =>
  renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkDirective, remarkAncorasDeArtigo]}>{md}</ReactMarkdown>);

describe('idDoArtigo e rotuloDoId', () => {
  it('converte o rótulo em id estável e de volta', () => {
    expect(idDoArtigo('Art. 75.')).toBe('art-75');
    expect(idDoArtigo('Art. 1º')).toBe('art-1');
    expect(idDoArtigo('Art. 184-A.')).toBe('art-184-a');
    expect(idDoArtigo('Art . 8º')).toBe('art-8');
    expect(idDoArtigo('§ 1º')).toBeNull();
    expect(rotuloDoId('art-1')).toBe('art. 1º');
    expect(rotuloDoId('art-75')).toBe('art. 75');
    expect(rotuloDoId('art-184-a')).toBe('art. 184-A');
  });
});

describe('remarkAncorasDeArtigo', () => {
  it('dá id ao parágrafo do artigo, e só a ele', () => {
    const out = html('**Art. 1º** Esta Lei estabelece normas.\n\n§ 1º Não se aplica.\n\n**Art. 184-A.** Texto.');
    expect(out).toContain('<p id="art-1"><strong>Art. 1º</strong>');
    expect(out).toContain('<p id="art-184-a">');
    expect(out).not.toMatch(/<p id="[^"]*">§/);
  });
  it('ignora artigos citados em bloco de alteração e rótulos repetidos', () => {
    const md = [
      '**Art. 1º** A Lei nº 8.666 passa a vigorar com as seguintes alterações:',
      ':::alteracao',
      '**Art. 2º** Texto da outra lei.',
      ':::',
      '**Art. 2º** Esta Lei entra em vigor na data de sua publicação.',
      '**Art. 2º** Rótulo repetido.',
    ].join('\n\n');
    const out = html(md);
    expect(out.match(/id="art-2"/g)).toHaveLength(1);
    expect(out).toContain('<p id="art-2"><strong>Art. 2º</strong> Esta Lei entra em vigor');
  });
});
