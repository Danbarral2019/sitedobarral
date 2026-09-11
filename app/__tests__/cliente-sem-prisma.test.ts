// @vitest-environment node
/**
 * Guarda da issue #212: um módulo 'use client' não pode importar, por valor,
 * um módulo de `lib/` que fale com o Prisma. O bundler empacota o módulo
 * inteiro para o navegador — inclusive a instanciação do PrismaClient —, e a
 * função importada só consegue lançar erro lá.
 *
 * Importação só de tipo é permitida, mas precisa ser explícita (`import type`
 * ou `{ type X }`): a varredura não tem como saber se `{ X }` é uma interface.
 *
 * A checagem é de um nível: olha se o módulo importado importa `lib/prisma`
 * diretamente. Não segue a cadeia inteira.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = path.resolve(__dirname, '..', '..');
const PASTAS = ['app', 'components', 'hooks'];
const IGNORAR = new Set(['node_modules', '.next', '.claude', '__tests__']);

// Violações anteriores à #212, fora do escopo dela. Ficam listadas para não
// crescerem; ao corrigir uma, remova a linha (o segundo teste cobra isso).
const CONHECIDAS = new Set([
  'app/artigos/page.tsx -> @/lib/article-utils',
  'components/ArticleBadges.tsx -> @/lib/article-utils',
  'components/ArticleTreeNavigator.tsx -> @/lib/article-utils',
  'components/lms/GamificationSidebar.tsx -> @/lib/gamification',
]);

function listarFontes(pasta: string): string[] {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return IGNORAR.has(entrada.name) ? [] : listarFontes(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) && !/\.(test|spec)\./.test(entrada.name) ? [caminho] : [];
  });
}

function resolverLib(especificador: string): string | undefined {
  const base = path.join(RAIZ, especificador.replace(/^@\//, ''));
  return [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((c) => fs.existsSync(c));
}

function importaPrisma(arquivo: string): boolean {
  const fonte = fs.readFileSync(arquivo, 'utf8');
  return /^import\s+(?!type\b)[^;'"]*?from\s+['"](\.{1,2}\/prisma|@\/lib\/prisma)['"]/m.test(fonte);
}

function soTipos(especificadores: string): boolean {
  const corpo = especificadores.trim();
  if (!corpo.startsWith('{')) return false;
  const nomes = corpo.slice(1, corpo.lastIndexOf('}')).split(',').map((n) => n.trim()).filter(Boolean);
  return nomes.length > 0 && nomes.every((n) => n.startsWith('type '));
}

function encontrarViolacoes(): string[] {
  const violacoes: string[] = [];
  for (const arquivo of PASTAS.flatMap((p) => listarFontes(path.join(RAIZ, p)))) {
    const fonte = fs.readFileSync(arquivo, 'utf8');
    if (!/^\s*['"]use client['"]/.test(fonte)) continue;
    for (const m of fonte.matchAll(/^import\s+(type\s+)?([^;'"]*?)\s+from\s+['"](@\/lib\/[^'"]+)['"]/gm)) {
      const [, marcaTipo, especificadores, origem] = m;
      if (marcaTipo || soTipos(especificadores)) continue;
      const alvo = resolverLib(origem);
      if (alvo && importaPrisma(alvo)) {
        violacoes.push(`${path.relative(RAIZ, arquivo).split(path.sep).join('/')} -> ${origem}`);
      }
    }
  }
  return violacoes;
}

describe('modulos de cliente nao arrastam o Prisma para o navegador', () => {
  const violacoes = encontrarViolacoes();

  it('nenhum modulo use client importa por valor um lib que usa o Prisma', () => {
    expect(violacoes.filter((v) => !CONHECIDAS.has(v))).toEqual([]);
  });

  it('a lista de violacoes conhecidas nao guarda entrada ja resolvida', () => {
    expect([...CONHECIDAS].filter((v) => !violacoes.includes(v))).toEqual([]);
  });
});
