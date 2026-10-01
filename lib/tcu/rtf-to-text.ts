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
import { descartarGruposBinarios } from './rtf-filtro-binario';

/**
 * Parágrafo que é dump hexadecimal de imagem (EMF/WMF), não texto.
 *
 * Heurística: um run CONTÍGUO de 100+ caracteres em `[0-9a-f]`, sem espaço
 * nem pontuação no meio. Um dump EMF/WMF é uma sequência ininterrupta de
 * milhares desses caracteres; texto legítimo nunca produz um run tão longo
 * sem quebra — nem tabelas de valores (um CNPJ tem só 14 dígitos seguidos).
 *
 * A implementação anterior media DENSIDADE de `[0-9a-f]` no parágrafo
 * inteiro (>92%) — mas essa classe inclui os dígitos decimais (0-9), não só
 * hexadecimais. Acórdãos do TCU têm parágrafos inteiros de tabelas de
 * valores, quantitativos e CNPJs, que são dominados por dígitos decimais e
 * ultrapassavam os 92% mesmo sendo texto legítimo — a densidade de dígitos
 * não é a mesma coisa que densidade de hexadecimal.
 */
function ehDumpBinario(s: string): boolean {
  return /[0-9a-f]{100,}/i.test(s.trim());
}

/**
 * Neutraliza os control symbols `\_` (hífen inquebrável) e `\-` (hífen
 * discricionário) antes de entregar o RTF ao parser.
 *
 * Por quê: `rtf-parser@1.3.3` tem um bug no `parseControlSymbol` — os ramos
 * de `\~`, `\*` e `\'` resetam o estado do parser de volta para texto, mas os
 * de `\_` e `\-` esquecem. O resultado é que a `\` imediatamente seguinte é
 * lida como "empty control word" e a extração inteira falha (rejeita a
 * promise). O TCU usa `\_`/`\~` justamente nas citações de precedente —
 * "Acórdão 4851/2017 – TCU – 1ª Câmara" — presentes em quase todo acórdão,
 * o que fazia ~28% deles falharem como se fossem "RTF malformado". Não eram:
 * o RTF do TCU é válido; o parser é que tropeça.
 *
 * A regex consome `\\` (barra literal) como par ANTES de examinar os símbolos,
 * então `\\_` (barra literal + underscore de texto) é preservado, e só o
 * control symbol `\_` de fato é reescrito.
 *   `\_` → `-`  (hífen inquebrável vira hífen comum; a nuance não afeta a análise)
 *   `\-` → ''   (hífen discricionário: ponto de quebra invisível fora da margem)
 */
function neutralizarHifensInquebráveis(rtf: string): string {
  return rtf.replace(/\\\\|\\[_-]/g, (m) => (m === '\\\\' ? m : m === '\\_' ? '-' : ''));
}

/**
 * Mesma família de bug: `rtf-parser@1.3.3` chama `emitIndexSubEntry` (`\:`,
 * subentrada de índice) e `emitFormula` (`\|`), que não existem, e a extração
 * inteira rejeita. Os dois só aparecem em campos de índice, sem texto útil.
 * Mesma guarda do `\\` literal da função acima.
 */
function neutralizarSimbolosSemHandler(rtf: string): string {
  return rtf.replace(/\\\\|\\[:|]/g, (m) => (m === '\\\\' ? m : m === '\\:' ? ':' : ''));
}

/**
 * `\fcharsetN` que o parser não sabe decodificar vira `\fcharset0` (ANSI).
 * O `rtf-parser` mapeia 2 (Symbol) para uma codificação que o iconv-lite não
 * conhece, e rejeita códigos fora da tabela (visto: 79). Em 30/09/2026 isso
 * derrubava 17 acórdãos inteiros só por declararem uma fonte dessas na tabela
 * de fontes. Decodificar esses trechos como ANSI troca, no máximo, um símbolo
 * ou uma letra grega por outro caractere; o resto do texto não muda.
 */
const CHARSETS_DECODIFICAVEIS = new Set([0, 1, 77, 128, 129, 134, 136, 161, 162, 163, 177, 178, 186, 204, 222, 254]);

function normalizarCharsets(rtf: string): string {
  return rtf.replace(/\\fcharset(\d+)/g, (m, n: string) =>
    CHARSETS_DECODIFICAVEIS.has(Number(n)) ? m : '\\fcharset0'
  );
}

export async function rtfToText(buf: Buffer): Promise<string> {
  // Imagens e objetos embutidos saem antes do parser: são quase todo o peso
  // dos RTFs grandes e o que estourava a pilha dele (rtf-filtro-binario.ts).
  // O RTF do TCU é cp1252; latin1 preserva os bytes para a lib decodificar \'hh.
  const rtf = normalizarCharsets(
    neutralizarSimbolosSemHandler(
      neutralizarHifensInquebráveis(descartarGruposBinarios(buf).toString('latin1'))
    )
  );

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
