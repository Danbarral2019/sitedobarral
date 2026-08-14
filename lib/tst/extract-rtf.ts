/**
 * Extração de texto plano do RTF do "Livro de Súmulas, OJs e PNs do TST"
 * (Res. 225/2025).
 *
 * O RTF do TST não embarca hyperlinks (`HYPERLINK` ou `https://` zero
 * ocorrências), só PAGE fields para numeração. Logo não há URL para extrair
 * via parser RTF customizado, e basta converter o texto.
 *
 * A conversão resolve-se em tempo de execução, e não por configuração, porque
 * o projeto roda em duas máquinas com ferramentas distintas:
 *
 *   1. Caminho terminado em `.txt`: entra direto, sem conversão. Serve para
 *      texto já extraído por outro meio.
 *   2. `textutil` (Apple Foundation), sempre presente no macOS, robusto às
 *      variações do formato.
 *   3. `striprtf`, do Python, quando o `textutil` não existe, que é o caso do
 *      Windows. Instala-se com `python -m pip install striprtf`.
 *
 * Faltando os três, lança erro que nomeia as saídas, em vez de falhar com
 * ENOENT cru, como fazia até 14 de agosto de 2026, quando a importação foi
 * tentada no Windows pela primeira vez.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const execFileP = promisify(execFile);

/** O livro passa de 5 MB em texto; o teto padrão de 1 MB truncaria a saída. */
const MAX_BUFFER = 256 * 1024 * 1024;

export interface RtfExtractResult {
  /** Texto plano resultante (equivalente ao output do `textutil`). */
  rawText: string;
  /**
   * Mapa rotulo→URL com hyperlinks "Inteiro teor no formato HTML".
   * **NOTA:** o RTF do Livro do TST 2025 não embarca hyperlinks — este mapa
   * fica vazio. As URLs das Súmulas que já estão no banco são preservadas
   * pelo importador (que não sobrescreve `url` quando o novo for null).
   */
  urls: Map<string, string>;
}

function ausente(erro: unknown): boolean {
  return (erro as NodeJS.ErrnoException)?.code === 'ENOENT';
}

/** macOS. */
async function comTextutil(rtfPath: string): Promise<string> {
  const tmpFile = path.join(tmpdir(), `tst-livro-${randomBytes(8).toString('hex')}.txt`);
  try {
    await execFileP('textutil', ['-convert', 'txt', '-encoding', 'UTF-8', '-output', tmpFile, rtfPath]);
    return await readFile(tmpFile, 'utf-8');
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/** Windows e Linux, sem dependência de npm. */
async function comStriprtf(rtfPath: string): Promise<string> {
  const programa = [
    'import sys, io',
    'from striprtf.striprtf import rtf_to_text',
    "sys.stdout.reconfigure(encoding='utf-8')",
    "bruto = io.open(sys.argv[1], encoding='latin-1', errors='replace').read()",
    "sys.stdout.write(rtf_to_text(bruto, errors='ignore'))",
  ].join('\n');

  let ultimoErro: unknown = null;
  for (const executavel of ['python3', 'python', 'py']) {
    try {
      const { stdout } = await execFileP(executavel, ['-c', programa, rtfPath], {
        maxBuffer: MAX_BUFFER,
        encoding: 'utf-8',
      });
      return stdout;
    } catch (e) {
      if (!ausente(e)) throw e;
      ultimoErro = e;
    }
  }
  throw ultimoErro ?? new Error('Python não localizado.');
}

/**
 * Converte um RTF em texto plano. Ver a nota do topo sobre a ordem tentada.
 */
export async function extractTstLivroRtf(rtfPath: string): Promise<RtfExtractResult> {
  if (rtfPath.toLowerCase().endsWith('.txt')) {
    return { rawText: await readFile(rtfPath, 'utf-8'), urls: new Map() };
  }

  try {
    return { rawText: await comTextutil(rtfPath), urls: new Map() };
  } catch (e) {
    if (!ausente(e)) throw e;
  }

  try {
    return { rawText: await comStriprtf(rtfPath), urls: new Map() };
  } catch (e) {
    if (!ausente(e)) throw e;
  }

  throw new Error(
    'Não há como converter o RTF nesta máquina. Saídas: instalar o striprtf ' +
      '(`python -m pip install striprtf`), rodar no macOS, onde há textutil, ' +
      'ou apontar TST_LIVRO_RTF para um arquivo .txt já extraído.',
  );
}
