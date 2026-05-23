/**
 * Extração de texto plano do RTF do "Livro de Súmulas, OJs e PNs do TST"
 * (Res. 225/2025).
 *
 * Estratégia pragmática: usar o `textutil` do macOS via shell. Razões:
 *   - O RTF do TST não embarca hyperlinks (`HYPERLINK` ou `https://` zero
 *     ocorrências) — só PAGE fields para numeração. Logo não há URL para
 *     extrair via parser RTF customizado.
 *   - `textutil` (Apple Foundation) é robusto, suporta variações do formato
 *     RTF perfeitamente e está sempre presente no macOS.
 *   - O ambiente de execução é local (Mac do Daniel), não produção.
 *
 * Para portar para Linux/CI no futuro: substituir por `unoconv` ou
 * `pandoc -f rtf -t plain`. Por ora, mantém-se minimalista.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const execFileP = promisify(execFile);

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

/**
 * Converte um RTF em texto plano usando `textutil` do macOS.
 */
export async function extractTstLivroRtf(rtfPath: string): Promise<RtfExtractResult> {
  const tmpFile = path.join(
    tmpdir(),
    `tst-livro-${randomBytes(8).toString('hex')}.txt`,
  );
  try {
    await execFileP('textutil', [
      '-convert',
      'txt',
      '-encoding',
      'UTF-8',
      '-output',
      tmpFile,
      rtfPath,
    ]);
    const rawText = await readFile(tmpFile, 'utf-8');
    return { rawText, urls: new Map() };
  } finally {
    // Limpa o arquivo temporário (ignora erro se não existir)
    try {
      await unlink(tmpFile);
    } catch {
      /* ignore */
    }
  }
}
