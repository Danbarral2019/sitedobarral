// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Guarda de arquitetura: nenhum código de produção pode gravar `tribunalCode`
 * com uma string literal em caixa baixa.
 *
 * Por que este teste existe. A forma canônica do campo no banco é UPPERCASE, e
 * `normalizeTribunalCode()` é a única autoridade — está escrito no JSDoc dela.
 * Mesmo assim, `sync-tcu-acordaos` gravou `tribunalCode: 'tcu'` literal por
 * meses, produzindo 121 registros que ficavam de fora do filtro e do boost por
 * tribunal na busca. O sintoma foi tratado duas vezes sem que a causa fosse:
 * primeiro com um script de migração de dados, depois com uma comparação
 * `UPPER()` case-insensitive em `vector-search.ts`. Os dois consertaram a
 * leitura; nenhum impediu a próxima escrita errada.
 *
 * Este teste ataca o ponto de escrita, que é onde a lição do projeto manda
 * normalizar. Ele cobre a CLASSE do defeito, não só o arquivo onde ele
 * apareceu — se alguém acrescentar um scraper novo com o código em minúsculo,
 * quebra aqui e não em produção seis meses depois.
 */

const RAIZES = ['app', 'lib', 'scripts'];
const IGNORAR_DIR = new Set(['node_modules', '__tests__', '.next', 'dist']);

/** `tribunalCode: 'tce-sp'` → pega. `tribunalCode: 'TCE-SP'` → não pega. */
const LITERAL_MINUSCULO = /tribunalCode:\s*['"`][^'"`]*[a-z][^'"`]*['"`]/g;

function arquivosTs(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (IGNORAR_DIR.has(entrada)) continue;
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) arquivosTs(caminho, acc);
    else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) acc.push(caminho);
  }
  return acc;
}

describe('normalização de tribunalCode no ponto de escrita', () => {
  it('nenhum arquivo de produção grava tribunalCode com literal em caixa baixa', () => {
    const raiz = process.cwd();
    const ofensores: string[] = [];

    for (const base of RAIZES) {
      let arquivos: string[];
      try {
        arquivos = arquivosTs(join(raiz, base));
      } catch {
        continue; // raiz ausente neste checkout
      }
      for (const arquivo of arquivos) {
        const conteudo = readFileSync(arquivo, 'utf8');
        const achados = conteudo.match(LITERAL_MINUSCULO);
        if (achados) {
          for (const a of achados) {
            ofensores.push(`${relative(raiz, arquivo)} → ${a.trim()}`);
          }
        }
      }
    }

    expect(
      ofensores,
      `Grave tribunalCode via normalizeTribunalCode() em vez de literal minúsculo:\n  ${ofensores.join('\n  ')}`,
    ).toEqual([]);
  });

  it('a própria regex distingue caixa alta de caixa baixa', () => {
    // Sem isto, um erro na regex faria o teste acima passar sempre — verde
    // decorativo, que é pior que teste nenhum.
    const alta = `tribunalCode: 'TCE-SP',`;
    const baixa = `tribunalCode: 'tce-sp',`;
    expect(alta.match(new RegExp(LITERAL_MINUSCULO.source, 'g'))).toBeNull();
    expect(baixa.match(new RegExp(LITERAL_MINUSCULO.source, 'g'))).toHaveLength(1);
  });
});
