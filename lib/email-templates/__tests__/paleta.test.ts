// @vitest-environment node
/**
 * Guarda da identidade visual dos e-mails.
 *
 * Antes desta migração, os 23 e-mails usavam 486 cores hexadecimais e nenhuma
 * delas era da paleta da casa: a dominante era #2563eb, o azul padrão do
 * Tailwind. Quem recebia o clipping diário e depois abria o site via dois
 * produtos diferentes.
 *
 * Estes testes leem o CÓDIGO-FONTE dos módulos de e-mail, não a saída
 * renderizada — o objetivo é impedir que uma cor de fora entre no repositório,
 * inclusive num caminho que nenhum teste de render exercite.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETA_EMAIL } from '../tokens';

const RAIZ = join(__dirname, '..', '..');

/** Módulos que produzem HTML de e-mail. */
const MODULOS = [
  'email.ts',
  'email-templates/shell.ts',
  'email-templates/subscription.ts',
  'email-templates/newsletter.ts',
  'email-templates/daily-clipping.ts',
  'email-templates/planning-announce.ts',
];

// O `(?<!&)` evita casar entidade HTML de emoji, como `&#128214;` (um livro),
// que de outro modo seria lida como se fosse a cor #128214.
const HEX = /(?<!&)#[0-9a-fA-F]{6}\b/g;

/**
 * Emoji e pictogramas. Cobre os blocos que apareciam nos assuntos (⏰ ⭐ 📧 📚)
 * sem varrer setas e sinais tipográficos legítimos.
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{23E9}-\u{23FA}]/u;

function ler(modulo: string): string {
  return readFileSync(join(RAIZ, modulo), 'utf-8');
}

describe('paleta dos e-mails', () => {
  it.each(MODULOS)('%s usa apenas cores da paleta da casa', (modulo) => {
    const fonte = ler(modulo);
    const foraDaPaleta = [...new Set(
      (fonte.match(HEX) ?? []).map((c) => c.toLowerCase()),
    )].filter((cor) => !PALETA_EMAIL.includes(cor));

    expect(
      foraDaPaleta,
      `${modulo} traz cores fora da paleta: ${foraDaPaleta.join(', ')}. `
      + 'Use EMAIL_COLOR de lib/email-templates/tokens.ts.',
    ).toEqual([]);
  });

  // Hexadecimal de 3 dígitos escapava das duas checagens acima: não casa com o
  // padrão de 6 e não está na paleta. Foi assim que 14 usos de `color: #333`
  // sobreviveram à primeira passada da migração.
  it.each(MODULOS)('%s não usa hexadecimal de 3 dígitos', (modulo) => {
    const curtas = ler(modulo).match(/(?<!&)#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g) ?? [];
    expect(
      [...new Set(curtas)],
      `${modulo} usa hexadecimal de 3 dígitos, que não pode estar na paleta`,
    ).toEqual([]);
  });
});

describe('linhas de assunto', () => {
  it.each(MODULOS)('%s não usa emoji em assunto', (modulo) => {
    const comEmoji = ler(modulo)
      .split('\n')
      .map((linha, i) => ({ linha: linha.trim(), n: i + 1 }))
      .filter(({ linha }) => /subject\s*[:=]/.test(linha) && EMOJI.test(linha));

    expect(
      comEmoji.map(({ n, linha }) => `${n}: ${linha.slice(0, 80)}`),
      `${modulo} tem emoji em linha de assunto. O relógio é urgência `
      + 'manufaturada, que o PRODUCT.md proíbe pelo nome.',
    ).toEqual([]);
  });

  it('nenhum assunto contém entidade HTML não decodificada', () => {
    // Assunto é texto puro: o cliente de e-mail não decodifica entidade, e o
    // destinatário leria o código cru. Já aconteceu com o aviso de Pix.
    for (const modulo of MODULOS) {
      const comEntidade = ler(modulo)
        .split('\n')
        .filter((l) => /subject\s*[:=]/.test(l) && /&[a-zA-Z]+;|&#\d+;/.test(l));
      expect(comEntidade, `${modulo} tem entidade HTML em assunto`).toEqual([]);
    }
  });
});
